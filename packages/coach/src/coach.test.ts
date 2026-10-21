import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDoctorReport, NO_FLAGS } from "./doctor.ts";
import { classifyMedication } from "./medications.ts";
import { muscleFreshness } from "./muscles.ts";
import { nutritionTargets } from "./nutrition.ts";
import { planDay, type CoachInput } from "./planner.ts";
import { nextTarget } from "./progression.ts";
import { bandOf, computeReadiness, restingHrFromSamples } from "./readiness.ts";
import type { DailyValue, Profile, SleepNight } from "./types.ts";

const H = 3600_000;
const D = 24 * H;
// 2026-10-21(수) 07:00 KST
const NOW = new Date("2026-10-20T22:00:00Z");

const profile: Profile = {
  age: 45,
  sex: "male",
  heightCm: 175,
  targetWeightKg: 70,
  goal: "lose",
  dumbbellsKg: [5, 7.5, 10, 12.5],
  hasPullUpBar: true,
  hasIndoorBike: true,
  weeklyRuns: 3,
  weeklyRides: 1,
  weeklyStrength: 2,
};

/** 최근 n일 동안 매일 밤 hours 시간 잔 기록 */
function nights(n: number, hours: number, deepRem = 0.4): SleepNight[] {
  return Array.from({ length: n }, (_, i) => {
    const end = new Date(NOW.getTime() - (n - 1 - i) * D - 0.5 * H);
    return { start: new Date(end.getTime() - hours * H), end, deepRemRatio: deepRem };
  });
}
const daily = (n: number, f: (i: number) => number): DailyValue[] =>
  Array.from({ length: n }, (_, i) => ({ date: new Date(NOW.getTime() - (n - 1 - i) * D - H), value: f(i) }));

const base: CoachInput = {
  now: NOW,
  profile,
  sleeps: nights(30, 7.5),
  restingHr: daily(30, () => 55),
  hrv: [],
  workouts: [],
  strengthSets: [],
  flags: NO_FLAGS,
};

test("Garmin 구간 경계", () => {
  assert.equal(bandOf(95), "prime");
  assert.equal(bandOf(75), "high");
  assert.equal(bandOf(74), "moderate");
  assert.equal(bandOf(24), "poor");
});

test("잘 자고 심박이 평소와 같으면 회복 점수가 높다", () => {
  const r = planDay(base).readiness;
  assert.ok(r.score >= 90, `score=${r.score}`);
  assert.equal(r.factors.hrv.score, null);
});

test("수면 4시간 + 안정시 심박 +8 이면 점수가 크게 떨어진다", () => {
  const r = computeReadiness({
    now: NOW,
    sleeps: [...nights(29, 7.5).slice(0, 28), ...nights(1, 4, 0.2)],
    restingHr: [...daily(30, () => 55).slice(0, 29), { date: new Date(NOW.getTime() - H), value: 63 }],
    hrv: [],
    loads28: new Array(28).fill(0),
  });
  assert.ok(r.score < 50, `score=${r.score}`);
  assert.equal(r.factors.restingHr.score, 20);
});

test("밤사이 안정시 심박은 수면 중 5분 평균의 최솟값", () => {
  const night = { start: new Date(0), end: new Date(8 * H) };
  const samples = Array.from({ length: 96 }, (_, i) => ({ time: new Date(i * 5 * 60_000), bpm: i >= 40 && i < 43 ? 48 : 60 }));
  assert.equal(restingHrFromSamples(samples, night), 48);
});

test("회복이 매우 낮으면 휴식 처방", () => {
  const plan = planDay({
    ...base,
    sleeps: [...nights(30, 7.5).slice(0, 29), ...nights(1, 3.5, 0.1)],
    restingHr: [...daily(30, () => 55).slice(0, 29), { date: new Date(NOW.getTime() - H), value: 66 }],
    checkIn: { energy: 1, stress: 5, soreness: ["quads", "calves"] },
  }).plan;
  assert.ok(plan.kind === "rest" || plan.kind === "recovery", plan.kind);
});

test("어제 하체 근력을 했으면 오늘은 하체 근력 대신 다른 운동", () => {
  const sets = ["goblet_squat", "db_rdl", "db_lunge"].flatMap((exercise) =>
    Array.from({ length: 4 }, () => ({ performedAt: new Date(NOW.getTime() - 20 * H), exercise, weightKg: 10, reps: 10 })),
  );
  const coaching = planDay({ ...base, strengthSets: sets });
  assert.ok(coaching.freshness.quads < 60, `quads=${coaching.freshness.quads}`);
  if (coaching.plan.kind === "strength") {
    assert.ok(!coaching.plan.strength!.some((t) => t.exercise === "goblet_squat"));
  }
});

test("이번 주 러닝 목표를 채웠으면 근력이나 자전거를 고른다", () => {
  const runs = [1, 3, 5].map((d) => ({ sport: "running", startedAt: new Date(NOW.getTime() - d * D), durationMin: 40, distanceM: 7000, avgHr: 140 }));
  const plan = planDay({ ...base, workouts: runs }).plan;
  assert.notEqual(plan.kind, "run");
});

test("베타차단제 복용 시 심박 구간 대신 RPE", () => {
  const coaching = planDay({ ...base, flags: { ...NO_FLAGS, betaBlocker: true } });
  assert.equal(coaching.hrZones, undefined);
  if (coaching.plan.kind !== "strength") assert.match(coaching.plan.intensityGuide, /RPE/);
});

test("점진적 과부하: 상한 반복을 다 하면 다음 덤벨로", () => {
  const history = Array.from({ length: 3 }, () => ({ performedAt: new Date(NOW.getTime() - 3 * D), exercise: "db_row", weightKg: 10, reps: 12 }));
  const t = nextTarget("db_row", 3, history, profile.dumbbellsKg);
  assert.equal(t.weightKg, 12.5);
  assert.equal(t.reps, 8);
});

test("점진적 과부하: 풀업 3회 미만이면 네거티브", () => {
  const history = [{ performedAt: new Date(NOW.getTime() - 3 * D), exercise: "pull_up", weightKg: 0, reps: 2 }];
  assert.equal(nextTarget("pull_up", 3, history, []).exercise, "negative_pull_up");
});

test("러닝은 종아리·허벅지 피로를 남긴다", () => {
  const f = muscleFreshness(NOW, [], [{ sport: "running", startedAt: new Date(NOW.getTime() - 2 * H), durationMin: 60, distanceM: 12000 }]);
  assert.ok(f.calves < 70 && f.quads < 80 && f.chest === 100, JSON.stringify(f));
});

test("감량 목표 칼로리와 신장 기능 저하 시 단백질 제한", () => {
  const weights = daily(21, () => 80);
  const t = nutritionTargets({ now: NOW, profile, weights, exerciseKcalToday: 0, flags: NO_FLAGS })!;
  // BMR = 10*80 + 6.25*175 - 5*45 + 5 = 1673.75 → ×1.25 - 500 = 1592
  assert.equal(t.bmr, 1674);
  assert.equal(t.kcal, 1674); // 기초대사량 아래로 내리지 않음
  assert.equal(t.proteinG, 128);
  const k = nutritionTargets({ now: NOW, profile, weights, exerciseKcalToday: 0, flags: { ...NO_FLAGS, reducedKidney: true } })!;
  assert.equal(k.proteinG, 64);
});

test("약 이름·성분으로 계열 판별", () => {
  assert.equal(classifyMedication({ name: "리피토정 10mg" }), "statin");
  assert.equal(classifyMedication({ name: "혈압약", ingredient: "Amlodipine" }), "ccb");
  assert.equal(classifyMedication({ name: "콩코르정" }), "betaBlocker");
  assert.equal(classifyMedication({ name: "오메가3" }), undefined);
});

test("주치의: 스타틴 복용 중 LDL 이 높으면 상담 권고 + 악화 항목 표시", () => {
  const report = buildDoctorReport({
    sex: "male",
    medications: [{ name: "크레스토정 5mg" }],
    checkups: [
      { date: new Date("2025-10-01"), results: [{ item: "ldl", value: 140 }, { item: "fasting_glucose", value: 98 }] },
      { date: new Date("2026-10-01"), results: [{ item: "ldl", value: 165 }, { item: "fasting_glucose", value: 108 }] },
    ],
    lifestyle: { weeklyAerobicMin: 90 },
  });
  assert.equal(report.flags.highLdl, true);
  assert.equal(report.flags.glucoseConcern, true);
  const ldl = report.items.find((i) => i.item === "ldl")!;
  assert.equal(ldl.severity, "high");
  assert.equal(ldl.change?.direction, "worse");
  assert.ok(report.concerns.some((c) => c.actions.some((a) => a.includes("약을 먹는데도"))));
  assert.ok(report.askAtNextVisit.some((q) => q.includes("LDL")));
});

test("주치의: 일부 항목만 있는 재검사가 추가돼도 다른 항목은 직전 값으로 유지", () => {
  const report = buildDoctorReport({
    sex: "male",
    medications: [],
    checkups: [
      { date: new Date("2026-10-01"), results: [{ item: "ldl", value: 162 }, { item: "alt", value: 42 }] },
      { date: new Date("2026-10-15"), results: [{ item: "ldl", value: 120 }] },
    ],
    lifestyle: {},
  });
  const ldl = report.items.find((i) => i.item === "ldl")!;
  assert.equal(ldl.value, 120);
  assert.equal(ldl.change?.direction, "better");
  assert.equal(report.items.find((i) => i.item === "alt")?.value, 42);
});
