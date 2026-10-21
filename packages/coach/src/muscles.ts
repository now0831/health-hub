import { EXERCISES, isExerciseKey } from "./exercises.ts";
import { HOUR, clamp } from "./load.ts";
import type { CheckIn, MuscleGroup, StrengthSetLog, WorkoutSummary } from "./types.ts";

/**
 * 부위별 회복도 (Fitbod 방식 참고).
 * 세트마다 해당 부위에 피로가 쌓이고, 시간에 따라 지수적으로 풀린다.
 * τ=36시간이면 고강도 6세트 후 약 48시간 뒤 80% 정도 회복된다.
 */
const TAU_HOURS = 36;
const FATIGUE_PER_SET = 12;

/** 유산소 운동이 하체에 주는 피로 (10km 러닝 / 30분 자전거 기준) */
const RUN_FATIGUE_PER_10KM: Partial<Record<MuscleGroup, number>> = { quads: 30, hamstrings: 20, glutes: 20, calves: 35 };
const BIKE_FATIGUE_PER_30MIN: Partial<Record<MuscleGroup, number>> = { quads: 25, glutes: 15, calves: 5 };

/** 근육통을 체크한 부위는 최소 이만큼 피로한 것으로 본다 */
const SORENESS_FLOOR = 60;

export type MuscleFreshness = Record<MuscleGroup, number>;

export function muscleFreshness(
  now: Date,
  sets: StrengthSetLog[],
  workouts: WorkoutSummary[],
  checkIn?: CheckIn,
): MuscleFreshness {
  const fatigue: Record<MuscleGroup, number> = {
    chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0,
    core: 0, quads: 0, hamstrings: 0, glutes: 0, calves: 0,
  };
  const decay = (t: Date) => Math.exp(-(now.getTime() - t.getTime()) / HOUR / TAU_HOURS);

  for (const s of sets) {
    if (!isExerciseKey(s.exercise)) continue;
    const d = decay(s.performedAt);
    for (const [m, w] of Object.entries(EXERCISES[s.exercise].muscles)) {
      fatigue[m as MuscleGroup] += FATIGUE_PER_SET * w * d;
    }
  }

  for (const w of workouts) {
    const d = decay(w.startedAt);
    if (w.sport.startsWith("running")) {
      const scale = (w.distanceM ?? w.durationMin * 170) / 10_000; // 거리 없으면 약 6분/km 가정
      for (const [m, f] of Object.entries(RUN_FATIGUE_PER_10KM)) fatigue[m as MuscleGroup] += f * scale * d;
    } else if (w.sport.startsWith("cycling")) {
      const scale = w.durationMin / 30;
      for (const [m, f] of Object.entries(BIKE_FATIGUE_PER_30MIN)) fatigue[m as MuscleGroup] += f * scale * d;
    }
  }

  for (const m of checkIn?.soreness ?? []) fatigue[m] = Math.max(fatigue[m], SORENESS_FLOOR);

  return Object.fromEntries(
    Object.entries(fatigue).map(([m, f]) => [m, Math.round(clamp(100 - f))]),
  ) as MuscleFreshness;
}

export const avgFreshness = (f: MuscleFreshness, groups: MuscleGroup[]) =>
  groups.reduce((a, g) => a + f[g], 0) / groups.length;
