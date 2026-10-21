import type { HealthFlags } from "./doctor.ts";
import { EXERCISES, LOWER, MUSCLE_LABELS, UPPER, type ExerciseKey } from "./exercises.ts";
import { DAY, dailyLoads, maxHeartRate, mean, startOfDay, trimp } from "./load.ts";
import { avgFreshness, muscleFreshness, type MuscleFreshness } from "./muscles.ts";
import { nextTarget, type SetTarget } from "./progression.ts";
import { computeReadiness, type Readiness, type ReadinessBand } from "./readiness.ts";
import type { CheckIn, DailyValue, Profile, SleepNight, StrengthSetLog, WorkoutSummary } from "./types.ts";

export type SessionKind = "rest" | "recovery" | "run" | "bike" | "strength" | "done";

export type HrZone = { zone: number; label: string; low: number; high: number };

export type SessionPlan = {
  kind: SessionKind;
  title: string;
  summary: string;
  durationMin: number;
  steps: { label: string; detail: string }[];
  strength?: SetTarget[];
  /** 이번 세션에서 쓸 강도 기준 (심박 구간 또는 체감 강도) */
  intensityGuide: string;
  alternatives: string[];
  notes: string[];
};

export type WeeklyProgress = {
  runs: { done: number; target: number };
  rides: { done: number; target: number };
  strength: { done: number; target: number };
  aerobicMin: number;
};

export type DailyCoaching = {
  date: string;
  readiness: Readiness;
  freshness: MuscleFreshness;
  plan: SessionPlan;
  weekly: WeeklyProgress;
  hrZones?: HrZone[];
};

export type CoachInput = {
  now: Date;
  profile: Profile;
  sleeps: SleepNight[];
  restingHr: DailyValue[];
  hrv: DailyValue[];
  /** 최근 42일 */
  workouts: WorkoutSummary[];
  /** 최근 28일 */
  strengthSets: StrengthSetLog[];
  checkIn?: CheckIn;
  flags: HealthFlags;
};

const LEVEL: Record<ReadinessBand, number> = { poor: 0, low: 1, moderate: 2, high: 3, prime: 4 };

const isRun = (w: WorkoutSummary) => w.sport.startsWith("running");
const isBike = (w: WorkoutSummary) => w.sport.startsWith("cycling");
const isAerobic = (w: WorkoutSummary) => isRun(w) || isBike(w) || w.sport === "walking" || w.sport === "hiking";

/** 심박 예비율(Karvonen) 기반 5구간 */
export function heartRateZones(profile: Profile, restingHr: number): HrZone[] {
  const max = maxHeartRate(profile);
  const z = (lo: number, hi: number) => [Math.round(restingHr + (max - restingHr) * lo), Math.round(restingHr + (max - restingHr) * hi)] as const;
  return [
    { zone: 1, label: "회복", ...range(z(0.5, 0.6)) },
    { zone: 2, label: "지구력", ...range(z(0.6, 0.7)) },
    { zone: 3, label: "템포", ...range(z(0.7, 0.8)) },
    { zone: 4, label: "역치", ...range(z(0.8, 0.9)) },
    { zone: 5, label: "최대", ...range(z(0.9, 1)) },
  ];
}
const range = ([low, high]: readonly [number, number]) => ({ low, high });

/** 베타차단제 복용 시 심박 대신 쓰는 체감 강도 (RPE 1~10) */
const RPE: Record<number, string> = {
  1: "RPE 2~3 (아주 편함, 노래 가능)",
  2: "RPE 3~4 (대화 가능)",
  3: "RPE 5~6 (짧은 문장만 가능)",
  4: "RPE 7~8 (몇 단어만 가능)",
  5: "RPE 9 (말하기 어려움)",
};

export function planDay(input: CoachInput): DailyCoaching {
  const { now, profile, flags } = input;
  const today = startOfDay(now);
  const rhrBase = mean(input.restingHr.slice(-30).map((v) => v.value));
  const restingHr = Number.isFinite(rhrBase) ? rhrBase : 60;

  const loads28 = dailyLoads(now, 28, input.workouts, input.strengthSets, profile, restingHr);
  const lastSession = lastSignificantSession(input, restingHr);
  const readiness = computeReadiness({
    now,
    sleeps: input.sleeps,
    restingHr: input.restingHr,
    hrv: input.hrv,
    loads28,
    lastSession,
    checkIn: input.checkIn,
  });
  const freshness = muscleFreshness(now, input.strengthSets, input.workouts, input.checkIn);
  const weekly = weeklyProgress(input, today);
  const zones = heartRateZones(profile, restingHr);

  const zoneText = (zone: number) => {
    const z = zones[zone - 1]!;
    return flags.betaBlocker ? RPE[zone]! : `Z${zone} ${z.label} (${z.low}~${z.high}bpm)`;
  };

  const doneToday =
    input.workouts.some((w) => w.startedAt >= today && w.durationMin >= 15) ||
    input.strengthSets.filter((s) => s.performedAt >= today).length >= 6;

  const level = LEVEL[readiness.band];
  let plan: SessionPlan;
  if (doneToday) {
    plan = {
      kind: "done",
      title: "오늘 운동 완료",
      summary: "수고하셨습니다. 단백질을 챙기고 일찍 주무세요.",
      durationMin: 0,
      steps: [{ label: "회복", detail: "가벼운 스트레칭 10분, 물 충분히" }],
      intensityGuide: "",
      alternatives: [],
      notes: [],
    };
  } else if (level === 0) {
    plan = restPlan(readiness);
  } else if (level === 1) {
    plan = recoveryPlan(profile, zoneText);
  } else {
    plan = choosePlan(input, level, freshness, weekly, zoneText, today, zones);
  }

  plan.notes.push(...healthNotes(plan.kind, flags));
  if (readiness.coverage < 0.5) {
    plan.notes.push("데이터가 부족해 회복 점수의 신뢰도가 낮습니다. 컨디션 체크를 하면 더 정확해집니다.");
  }

  return {
    date: today.toISOString(),
    readiness,
    freshness,
    plan,
    weekly,
    hrZones: flags.betaBlocker ? undefined : zones,
  };
}

function lastSignificantSession(input: CoachInput, restingHr: number) {
  const sessions: { at: Date; load: number }[] = input.workouts.map((w) => ({ at: w.startedAt, load: trimp(w, input.profile, restingHr) }));
  // 근력 세트는 하루 단위로 묶는다
  const byDay = new Map<number, { at: Date; load: number }>();
  for (const s of input.strengthSets) {
    const k = startOfDay(s.performedAt).getTime();
    const cur = byDay.get(k) ?? { at: s.performedAt, load: 0 };
    cur.load += 6;
    if (s.performedAt > cur.at) cur.at = s.performedAt;
    byDay.set(k, cur);
  }
  sessions.push(...byDay.values());
  return sessions.filter((s) => s.load >= 50).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
}

function weeklyProgress(input: CoachInput, today: Date): WeeklyProgress {
  const from = new Date(today.getTime() - 6 * DAY);
  const week = input.workouts.filter((w) => w.startedAt >= from);
  const strengthDays = new Set(
    input.strengthSets.filter((s) => s.performedAt >= from).map((s) => startOfDay(s.performedAt).getTime()),
  );
  for (const w of week) if (w.sport === "strength") strengthDays.add(startOfDay(w.startedAt).getTime());
  return {
    runs: { done: week.filter(isRun).length, target: input.profile.weeklyRuns },
    rides: { done: week.filter(isBike).length, target: input.profile.weeklyRides },
    strength: { done: strengthDays.size, target: input.profile.weeklyStrength },
    aerobicMin: Math.round(week.filter(isAerobic).reduce((a, w) => a + w.durationMin, 0)),
  };
}

function restPlan(r: Readiness): SessionPlan {
  const worst = Object.values(r.factors)
    .filter((f) => f.score !== null && f.score < 50)
    .map((f) => f.detail);
  return {
    kind: "rest",
    title: "오늘은 쉬는 날",
    summary: "회복이 많이 부족합니다. 운동보다 휴식이 더 큰 효과를 냅니다.",
    durationMin: 0,
    steps: [
      { label: "가벼운 활동", detail: "산책 20분 이내, 폼롤러·스트레칭" },
      { label: "수면", detail: "오늘 밤 평소보다 30분 일찍 잠자리에 들기" },
    ],
    intensityGuide: "",
    alternatives: [],
    notes: worst.length ? [`낮은 항목: ${worst.join(" / ")}`] : [],
  };
}

function recoveryPlan(profile: Profile, zoneText: (z: number) => string): SessionPlan {
  const bike = profile.hasIndoorBike;
  return {
    kind: "recovery",
    title: bike ? "회복 라이딩 25분" : "회복 걷기 35분",
    summary: "몸을 가볍게 움직여 혈액순환을 돕는 정도로만 합니다.",
    durationMin: bike ? 25 : 35,
    steps: [
      { label: bike ? "실내자전거" : "빠르게 걷기", detail: `${bike ? 25 : 35}분, ${zoneText(1)}` },
      { label: "스트레칭", detail: "고관절·햄스트링·종아리 각 1분" },
    ],
    intensityGuide: zoneText(1),
    alternatives: bike ? ["걷기 35분"] : [],
    notes: [],
  };
}

function choosePlan(
  input: CoachInput,
  level: number,
  fresh: MuscleFreshness,
  weekly: WeeklyProgress,
  zoneText: (z: number) => string,
  today: Date,
  zones: HrZone[],
): SessionPlan {
  const { profile } = input;
  const yesterday = new Date(today.getTime() - DAY);
  const ranYesterday = input.workouts.some((w) => isRun(w) && w.startedAt >= yesterday && w.startedAt < today);
  const strengthYesterday = input.strengthSets.some((s) => s.performedAt >= yesterday && s.performedAt < today);
  const legs = avgFreshness(fresh, LOWER);
  const upper = avgFreshness(fresh, UPPER);

  const deficit = (p: { done: number; target: number }) => Math.max(0, p.target - p.done);
  const scores: { kind: "run" | "bike" | "strength"; score: number }[] = [
    { kind: "run", score: deficit(weekly.runs) * 2 + (legs - 60) / 20 - (ranYesterday ? 2 : 0) - (fresh.calves < 55 ? 2 : 0) },
    { kind: "strength", score: deficit(weekly.strength) * 2 + (Math.max(upper, legs) - 60) / 20 - (strengthYesterday ? 1.5 : 0) },
  ];
  if (profile.hasIndoorBike) {
    scores.push({ kind: "bike", score: deficit(weekly.rides) * 2 + (legs - 50) / 25 + (ranYesterday || fresh.calves < 55 ? 1 : 0) });
  }
  scores.sort((a, b) => b.score - a.score);
  const pick = scores[0]!.kind;

  const recentRuns = input.workouts.filter(isRun).filter((w) => w.startedAt.getTime() > today.getTime() - 28 * DAY);
  const avgRunMin = recentRuns.length ? mean(recentRuns.map((w) => w.durationMin)) : 30;

  let plan: SessionPlan;
  if (pick === "run") plan = runPlan(level, avgRunMin, input, today, zoneText, zones);
  else if (pick === "bike") plan = bikePlan(level, zoneText);
  else plan = strengthPlan(level, fresh, input);

  const others = scores.slice(1).map((s) => s.kind);
  if (pick === "run" && profile.hasIndoorBike) plan.alternatives.push("무릎·종아리가 불편하면 실내자전거로 같은 시간, 같은 강도");
  if (pick !== "strength" && others.includes("strength")) plan.alternatives.push("시간이 없으면 근력 운동 20분 (상체 위주)");
  return plan;
}

function runPlan(
  level: number,
  avgMin: number,
  input: CoachInput,
  today: Date,
  zoneText: (z: number) => string,
  zones: HrZone[],
): SessionPlan {
  const daysSinceQuality = (() => {
    // 평균 심박이 Z3 이상이었던 러닝을 "질 높은 훈련"으로 본다
    const q = input.workouts
      .filter((w) => isRun(w) && w.avgHr !== undefined && w.avgHr >= zones[2]!.low)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
    return q ? (today.getTime() - startOfDay(q.startedAt).getTime()) / DAY : Infinity;
  })();
  const weekday = new Date(today.getTime() + 9 * 3600_000).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const easyMin = Math.round(Math.min(Math.max(avgMin, 25), 60) / 5) * 5;

  if (level === 4 && weekend) {
    const min = Math.round((easyMin * 1.4) / 5) * 5;
    return {
      kind: "run",
      title: `롱런 ${min}분`,
      summary: "컨디션 최상인 주말 — 지구력을 키우는 긴 러닝입니다.",
      durationMin: min,
      steps: [{ label: "롱런", detail: `${min}분, ${zoneText(2)} 유지. 마지막 10분만 조금 빠르게` }],
      intensityGuide: zoneText(2),
      alternatives: [],
      notes: ["30분마다 물 한 모금"],
    };
  }
  if (level >= 3 && daysSinceQuality >= 3) {
    const intervals = level === 4;
    return intervals
      ? {
          kind: "run",
          title: "인터벌 러닝 (3분 × 6)",
          summary: "회복이 충분해 심폐 능력을 끌어올리는 고강도 훈련을 권합니다.",
          durationMin: 45,
          steps: [
            { label: "워밍업", detail: `10분 조깅, ${zoneText(2)}` },
            { label: "인터벌", detail: `3분 빠르게(${zoneText(4)}) + 2분 천천히 조깅 × 6회` },
            { label: "쿨다운", detail: "5~10분 조깅 후 걷기" },
          ],
          intensityGuide: zoneText(4),
          alternatives: [],
          notes: [],
        }
      : {
          kind: "run",
          title: "템포런 20분",
          summary: "좋은 컨디션 — '편하게 힘든' 속도로 유산소 역치를 높입니다.",
          durationMin: 40,
          steps: [
            { label: "워밍업", detail: `10분 조깅, ${zoneText(2)}` },
            { label: "템포", detail: `20분, ${zoneText(3)} 상단 ~ ${zoneText(4)} 하단` },
            { label: "쿨다운", detail: "10분 조깅 후 걷기" },
          ],
          intensityGuide: zoneText(3),
          alternatives: [],
          notes: [],
        };
  }
  return {
    kind: "run",
    title: `이지런 ${easyMin}분`,
    summary: level >= 3 ? "최근에 고강도 훈련을 했으니 오늘은 편하게 달립니다." : "무리하지 않는 지구력 러닝입니다.",
    durationMin: easyMin,
    steps: [{ label: "이지런", detail: `${easyMin}분, ${zoneText(2)} — 대화가 가능한 속도` }],
    intensityGuide: zoneText(2),
    alternatives: [],
    notes: [],
  };
}

function bikePlan(level: number, zoneText: (z: number) => string): SessionPlan {
  if (level === 4) {
    return {
      kind: "bike",
      title: "실내자전거 인터벌 (4분 × 5)",
      summary: "관절 부담 없이 심폐 능력을 끌어올립니다.",
      durationMin: 45,
      steps: [
        { label: "워밍업", detail: `10분, ${zoneText(2)}` },
        { label: "인터벌", detail: `4분 강하게(${zoneText(4)}~${zoneText(5)}) + 3분 가볍게 × 5회` },
        { label: "쿨다운", detail: "5분 가볍게" },
      ],
      intensityGuide: zoneText(4),
      alternatives: [],
      notes: [],
    };
  }
  if (level === 3) {
    return {
      kind: "bike",
      title: "실내자전거 스윗스팟 (10분 × 3)",
      summary: "지구력과 근지구력을 함께 키우는 중강도 훈련입니다.",
      durationMin: 50,
      steps: [
        { label: "워밍업", detail: `10분, ${zoneText(2)}` },
        { label: "스윗스팟", detail: `10분(${zoneText(3)}) + 5분 가볍게 × 3회` },
        { label: "쿨다운", detail: "5분 가볍게" },
      ],
      intensityGuide: zoneText(3),
      alternatives: [],
      notes: [],
    };
  }
  return {
    kind: "bike",
    title: "실내자전거 지구력 40분",
    summary: "하체 부담이 적은 유산소 운동입니다.",
    durationMin: 40,
    steps: [{ label: "라이딩", detail: `40분, ${zoneText(2)}, 페달 회전수 80~90rpm` }],
    intensityGuide: zoneText(2),
    alternatives: [],
    notes: [],
  };
}

function strengthPlan(level: number, fresh: MuscleFreshness, input: CoachInput): SessionPlan {
  const { profile } = input;
  const legs = avgFreshness(fresh, LOWER);
  const upper = avgFreshness(fresh, UPPER);
  const split: "full" | "upper" | "lower" = legs >= 70 && upper >= 70 ? "full" : upper >= legs ? "upper" : "lower";
  const bar = profile.hasPullUpBar;
  const pull: ExerciseKey = bar ? "pull_up" : "db_row";

  const templates: Record<typeof split, ExerciseKey[]> = {
    full: ["goblet_squat", "db_rdl", "db_floor_press", pull, "db_shoulder_press", bar ? "hanging_knee_raise" : "plank"],
    upper: ["db_floor_press", pull, bar ? "db_row" : "push_up", "db_shoulder_press", "db_curl", "db_overhead_extension", bar ? "hanging_knee_raise" : "plank"],
    lower: ["goblet_squat", "db_rdl", "db_lunge", "db_calf_raise", "plank"],
  };
  const noDumbbells = profile.dumbbellsKg.length === 0;
  const substitute = (k: ExerciseKey): ExerciseKey => (noDumbbells && k === "db_floor_press" ? "push_up" : k);

  const sets = level === 4 ? 4 : level === 3 ? 3 : 2;
  const mainMuscle = (k: ExerciseKey) =>
    Object.entries(EXERCISES[k].muscles).find(([, w]) => w === 1)?.[0] as keyof MuscleFreshness | undefined;
  const candidates = [...new Set(templates[split].map(substitute))];
  // 주동근이 아직 덜 회복된(50% 미만) 운동은 뺀다
  const chosen = candidates.filter((k) => {
    const main = mainMuscle(k);
    return !main || fresh[main] >= 50;
  });
  const skipped = [...new Set(candidates.filter((k) => !chosen.includes(k)).map((k) => MUSCLE_LABELS[mainMuscle(k)!]))];
  const targets = chosen.map((k) => nextTarget(k, sets, input.strengthSets, profile.dumbbellsKg));
  const minutes = targets.reduce((a, t) => a + t.sets * 2.5, 10);
  const title = { full: "전신 근력", upper: "상체 근력", lower: "하체 근력" }[split];

  return {
    kind: "strength",
    title: `${title} ${Math.round(minutes / 5) * 5}분`,
    summary:
      (split === "full"
        ? "상·하체 대부분 회복됐습니다. 전신을 고르게 자극합니다."
        : `${split === "upper" ? "하체" : "상체"}는 아직 회복 중이라 ${split === "upper" ? "상체" : "하체"} 위주로 구성했습니다.`) +
      (skipped.length ? ` ${skipped.join("·")}은(는) 회복 중이라 제외했습니다.` : ""),
    durationMin: Math.round(minutes),
    steps: [
      { label: "워밍업", detail: "5분 제자리 걷기·팔 돌리기, 첫 운동은 가벼운 무게로 1세트" },
      { label: "본운동", detail: `아래 ${targets.length}가지 × ${sets}세트, 세트 사이 60~90초 휴식` },
      { label: "마무리", detail: "5분 스트레칭" },
    ],
    strength: targets,
    intensityGuide: "세트마다 1~2회 더 할 수 있을 정도에서 멈추기 (RIR 1~2)",
    alternatives: [],
    notes: noDumbbells ? ["덤벨 정보가 없어 맨몸 기준입니다. 내 정보에서 보유 덤벨을 입력하세요."] : [],
  };
}

function healthNotes(kind: SessionKind, f: HealthFlags): string[] {
  const n: string[] = [];
  if (f.betaBlocker && kind !== "rest" && kind !== "done") n.push("베타차단제 복용 중이라 심박 대신 체감 강도(RPE)로 안내합니다.");
  if (f.hypoglycemiaRisk && kind !== "rest" && kind !== "done") n.push("저혈당 위험 약을 복용 중입니다. 운동 전 혈당을 확인하고 사탕을 챙기세요.");
  if (f.hypertension && kind === "strength") n.push("들어올릴 때 숨을 내쉬고, 숨을 참지 마세요 (혈압 급상승 방지).");
  if (f.bleedingRisk && kind !== "rest" && kind !== "done") n.push("출혈 위험 약 복용 중 — 넘어지지 않게 주의하세요.");
  if (f.glucoseConcern && (kind === "run" || kind === "bike" || kind === "recovery")) n.push("식후 30분~1시간 사이에 운동하면 혈당 관리에 더 효과적입니다.");
  return n;
}
