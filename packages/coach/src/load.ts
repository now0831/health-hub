import type { Profile, StrengthSetLog, WorkoutSummary } from "./types.ts";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** 최대 심박. 직접 잰 값이 없으면 Tanaka 공식(208 - 0.7×나이) */
export function maxHeartRate(profile: Profile): number {
  if (profile.maxHr) return profile.maxHr;
  return Math.round(208 - 0.7 * (profile.age ?? 40));
}

/** 심박 정보가 없을 때 쓰는 종목별 평균 심박 예비율(HRR) 추정치 */
const DEFAULT_HRR: Record<string, number> = {
  running: 0.65,
  running_treadmill: 0.65,
  cycling: 0.55,
  cycling_indoor: 0.55,
  walking: 0.35,
  hiking: 0.5,
  strength: 0.45,
};

/**
 * Banister TRIMP: 운동 시간 × 심박 예비율 × 0.64·e^(k·HRR)
 * 강도가 높을수록 지수적으로 커져 "얼마나 힘든 운동이었나"를 하나의 숫자로 나타낸다.
 */
export function trimp(w: WorkoutSummary, profile: Profile, restingHr: number): number {
  const max = maxHeartRate(profile);
  const hrr =
    w.avgHr !== undefined
      ? Math.min(1, Math.max(0, (w.avgHr - restingHr) / (max - restingHr)))
      : (DEFAULT_HRR[w.sport] ?? 0.45);
  const k = profile.sex === "female" ? 1.67 : 1.92;
  return w.durationMin * hrr * 0.64 * Math.exp(k * hrr);
}

/** 근력 세트 부하. 세트당 약 2.5분 × 중간 강도로 환산 (TRIMP 와 같은 척도) */
export const STRENGTH_SET_LOAD = 6;

/** 하루 단위 부하 합계 (오늘 포함 days 일, 오늘이 마지막) */
export function dailyLoads(
  now: Date,
  days: number,
  workouts: WorkoutSummary[],
  sets: StrengthSetLog[],
  profile: Profile,
  restingHr: number,
): number[] {
  const loads = new Array<number>(days).fill(0);
  const idx = (t: Date) => days - 1 - Math.floor((startOfDay(now).getTime() - startOfDay(t).getTime()) / DAY);
  for (const w of workouts) {
    const i = idx(w.startedAt);
    if (i >= 0 && i < days) loads[i]! += trimp(w, profile, restingHr);
  }
  for (const s of sets) {
    const i = idx(s.performedAt);
    if (i >= 0 && i < days) loads[i]! += STRENGTH_SET_LOAD;
  }
  return loads;
}

/**
 * 급성(7일)/만성(28일) 부하 비율. 0.8~1.3 이 적정, 1.5 이상이면 부상 위험이 커진다는
 * 스포츠과학 연구(Gabbett 2016)를 따른다. 만성 부하가 거의 없으면 null.
 */
export function acuteChronicRatio(loads28: number[]): number | null {
  const acute = sum(loads28.slice(-7)) / 7;
  const chronic = sum(loads28) / 28;
  if (chronic < 5) return null;
  return acute / chronic;
}

/** KST 기준 하루 시작 */
export function startOfDay(d: Date): Date {
  const kst = new Date(d.getTime() + 9 * HOUR);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * HOUR);
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);
export const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
export { DAY, HOUR };
