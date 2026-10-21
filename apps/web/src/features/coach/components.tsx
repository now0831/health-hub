import {
  BAND_LABELS,
  EXERCISES,
  MUSCLE_LABELS,
  READINESS_WEIGHTS,
  type DailyCoaching,
  type MuscleGroup,
  type ReadinessFactor,
} from "@health/coach";
import Link from "next/link";
import { Card } from "@/components/ui";
import { Meter, StatusBadge, scoreTone, type Tone } from "@/components/meter";
import type { TodayCoaching } from "./today";
import { saveCheckIn } from "./actions";

const FACTOR_LABELS: Record<ReadinessFactor, string> = {
  sleep: "어젯밤 수면",
  sleepHistory: "최근 3일 수면",
  restingHr: "안정시 심박",
  hrv: "HRV",
  load: "운동 부하 균형",
  recovery: "회복 시간",
  subjective: "컨디션 체크",
};

export function ReadinessCard({ coaching }: { coaching: DailyCoaching }) {
  const r = coaching.readiness;
  const tone = scoreTone(r.score);
  return (
    <Card title="회복 점수">
      <div className="flex items-end gap-3">
        <span className="text-6xl font-semibold leading-none">{r.score}</span>
        <div className="pb-1">
          <StatusBadge tone={tone}>{BAND_LABELS[r.band]}</StatusBadge>
        </div>
      </div>
      <Meter value={r.score} tone={tone} label="회복 점수" className="mt-4 h-3" />
      {r.coverage < 0.5 && (
        <p className="mt-2 text-xs text-muted">반영된 데이터가 적어 점수 신뢰도가 낮습니다 ({Math.round(r.coverage * 100)}%).</p>
      )}
      <ul className="mt-5 space-y-3 text-sm">
        {(Object.keys(READINESS_WEIGHTS) as ReadinessFactor[]).map((k) => {
          const f = r.factors[k];
          return (
            <li key={k}>
              <div className="flex items-baseline justify-between gap-2">
                <span>{FACTOR_LABELS[k]}</span>
                <span className="tabular-nums text-muted">{f.score === null ? "—" : Math.round(f.score)}</span>
              </div>
              {f.score !== null && <Meter value={f.score} tone={scoreTone(f.score)} label={FACTOR_LABELS[k]} className="mt-1 h-1.5" />}
              <p className="mt-0.5 text-xs text-muted">{f.detail}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function PlanCard({ coaching }: { coaching: DailyCoaching }) {
  const p = coaching.plan;
  return (
    <Card title="오늘의 운동">
      <h3 className="text-xl font-semibold">{p.title}</h3>
      <p className="mt-1 text-sm text-muted">{p.summary}</p>
      {p.intensityGuide && (
        <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm">
          <span className="font-medium">강도</span> · {p.intensityGuide}
        </p>
      )}
      <ol className="mt-4 space-y-2 text-sm">
        {p.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-14 shrink-0 font-medium">{s.label}</span>
            <span className="text-muted">{s.detail}</span>
          </li>
        ))}
      </ol>

      {p.strength && p.strength.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">운동</th>
              <th className="py-1 text-right font-normal">목표</th>
            </tr>
          </thead>
          <tbody>
            {p.strength.map((t) => {
              const ex = EXERCISES[t.exercise];
              const unit = "timed" in ex && ex.timed ? "초" : "회";
              return (
                <tr key={t.exercise} className="border-t border-line align-top">
                  <td className="py-2">
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-xs text-muted">{ex.cue}</div>
                    <div className="text-xs text-accent">{t.reason}</div>
                  </td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">
                    {t.sets}세트 × {t.reps}
                    {unit}
                    {t.weightKg > 0 && <div className="text-xs text-muted">{t.weightKg}kg</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {p.alternatives.length > 0 && (
        <div className="mt-4 text-sm">
          <div className="font-medium">대안</div>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {p.alternatives.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {p.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {p.notes.map((n) => (
            <li key={n} className="flex gap-2">
              <StatusBadge tone="warning">주의</StatusBadge>
              <span className="text-muted">{n}</span>
            </li>
          ))}
        </ul>
      )}
      {coaching.hrZones && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">내 심박 구간</summary>
          <table className="mt-2 w-full tabular-nums">
            <tbody>
              {coaching.hrZones.map((z) => (
                <tr key={z.zone} className="border-t border-line">
                  <td className="py-1">Z{z.zone}</td>
                  <td className="py-1">{z.label}</td>
                  <td className="py-1 text-right">
                    {z.low}~{z.high} bpm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </Card>
  );
}

const SORENESS_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "core", "quads", "hamstrings", "glutes", "calves"];

export function CheckInForm({ checkIn }: { checkIn: TodayCoaching["checkIn"] }) {
  const scale = (name: string, label: string, low: string, high: string, current?: number) => (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        <span>{low}</span>
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v} className="flex cursor-pointer flex-col items-center">
            <input type="radio" name={name} value={v} defaultChecked={current === v} required className="accent-[var(--accent)]" />
            <span>{v}</span>
          </label>
        ))}
        <span>{high}</span>
      </div>
    </fieldset>
  );
  return (
    <Card title={checkIn ? "오늘 컨디션 (수정 가능)" : "오늘 컨디션 체크"}>
      <form action={saveCheckIn} className="space-y-4">
        {scale("energy", "에너지", "매우 피곤", "최상", checkIn?.energy)}
        {scale("stress", "스트레스", "낮음", "높음", checkIn?.stress)}
        <fieldset>
          <legend className="text-sm font-medium">근육통 부위</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SORENESS_GROUPS.map((g) => (
              <label key={g} className="cursor-pointer rounded-full border border-line px-3 py-1 text-xs has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                <input type="checkbox" name="soreness" value={g} defaultChecked={checkIn?.soreness.includes(g)} className="sr-only" />
                {MUSCLE_LABELS[g]}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">저장하고 다시 계산</button>
      </form>
    </Card>
  );
}

export function FreshnessCard({ coaching }: { coaching: DailyCoaching }) {
  return (
    <Card title="부위별 회복도">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((g) => {
          const v = coaching.freshness[g];
          const tone: Tone = v >= 80 ? "good" : v >= 50 ? "warning" : "serious";
          return (
            <li key={g}>
              <div className="flex justify-between">
                <span>{MUSCLE_LABELS[g]}</span>
                <span className="tabular-nums text-muted">{v}%</span>
              </div>
              <Meter value={v} tone={tone} label={`${MUSCLE_LABELS[g]} 회복도`} className="mt-1 h-1.5" />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function WeeklyCard({ coaching }: { coaching: DailyCoaching }) {
  const w = coaching.weekly;
  const row = (label: string, p: { done: number; target: number }) => (
    <li>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {p.done} / {p.target}회
        </span>
      </div>
      <Meter value={p.done} max={Math.max(p.target, 1)} tone={p.done >= p.target ? "good" : "accent"} label={`${label} 주간 진행`} className="mt-1 h-1.5" />
    </li>
  );
  return (
    <Card title="최근 7일">
      <ul className="space-y-3">
        {row("러닝", w.runs)}
        {row("실내자전거", w.rides)}
        {row("근력", w.strength)}
      </ul>
      <p className="mt-3 text-xs text-muted">유산소 {w.aerobicMin}분 (권장 주 150분 이상)</p>
    </Card>
  );
}

export function NutritionSummary({ nutrition, profileComplete }: { nutrition: TodayCoaching["nutrition"]; profileComplete: boolean }) {
  if (!nutrition) {
    return (
      <Card title="오늘 식단">
        <p className="text-sm text-muted">
          {profileComplete ? "체중 기록이 없어 목표를 계산할 수 없습니다. 체중계로 측정 후 동기화하세요." : "내 정보(나이·성별·키)를 입력하면 하루 목표를 계산합니다."}
        </p>
        <Link href={profileComplete ? "/nutrition" : "/profile"} className="mt-3 inline-block text-sm text-accent">
          {profileComplete ? "식단 기록하기 →" : "내 정보 입력 →"}
        </Link>
      </Card>
    );
  }
  const { targets, eaten } = nutrition;
  const rows: { label: string; eaten: number; target: number; unit: string; limit?: boolean }[] = [
    { label: "칼로리", eaten: eaten.kcal, target: targets.kcal, unit: "kcal" },
    { label: "단백질", eaten: eaten.proteinG, target: targets.proteinG, unit: "g" },
    { label: "탄수화물", eaten: eaten.carbsG, target: targets.carbsG, unit: "g" },
    { label: "지방", eaten: eaten.fatG, target: targets.fatG, unit: "g" },
    { label: "나트륨", eaten: eaten.sodiumMg, target: targets.sodiumMg, unit: "mg", limit: true },
  ];
  return (
    <Card title="오늘 식단">
      <ul className="space-y-3">
        {rows.map((r) => {
          const over = r.eaten > r.target * (r.limit ? 1 : 1.05);
          return (
            <li key={r.label}>
              <div className="flex justify-between text-sm">
                <span>
                  {r.label} {over && <StatusBadge tone="critical">초과</StatusBadge>}
                </span>
                <span className="tabular-nums text-muted">
                  {Math.round(r.eaten).toLocaleString("ko-KR")} / {r.target.toLocaleString("ko-KR")}
                  {r.unit}
                </span>
              </div>
              <Meter value={r.eaten} max={r.target} tone={over ? "critical" : "accent"} label={`${r.label} 섭취`} className="mt-1 h-1.5" />
            </li>
          );
        })}
      </ul>
      {targets.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {targets.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
      <Link href="/nutrition" className="mt-3 inline-block text-sm text-accent">
        식단 기록하기 →
      </Link>
    </Card>
  );
}
