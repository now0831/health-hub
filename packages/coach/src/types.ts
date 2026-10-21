/**
 * 코치·주치의 엔진의 입력 타입. DB 와 무관한 순수 데이터라 테스트하기 쉽다.
 * apps/web/src/features/coach/inputs.ts 가 DB 에서 이 형태로 모아 넘긴다.
 */

export type Sex = "male" | "female";
export type Goal = "lose" | "maintain" | "gain";

export type Profile = {
  age?: number;
  sex?: Sex;
  heightCm?: number;
  targetWeightKg?: number;
  goal: Goal;
  maxHr?: number;
  dumbbellsKg: number[];
  hasPullUpBar: boolean;
  hasIndoorBike: boolean;
  weeklyRuns: number;
  weeklyRides: number;
  weeklyStrength: number;
};

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves";

export type SleepNight = {
  start: Date;
  end: Date;
  /** 깊은 잠 + REM 비율 (0~1). 단계 정보가 없으면 undefined */
  deepRemRatio?: number;
};

/** 날짜별 값 (안정시 심박, HRV, 체중 등) */
export type DailyValue = { date: Date; value: number };

export type WorkoutSummary = {
  sport: string;
  startedAt: Date;
  durationMin: number;
  distanceM?: number;
  avgHr?: number;
  calories?: number;
};

export type StrengthSetLog = {
  performedAt: Date;
  exercise: string;
  weightKg: number;
  reps: number;
};

export type CheckIn = {
  energy: number;
  stress: number;
  soreness: MuscleGroup[];
};

export type MealTotals = { kcal: number; proteinG: number; fatG: number; carbsG: number; sodiumMg: number };
