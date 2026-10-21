import type { HealthFlags } from "./doctor.ts";
import { DAY, mean } from "./load.ts";
import type { DailyValue, MealTotals, Profile } from "./types.ts";

export type NutritionTargets = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  sodiumMg: number;
  bmr: number;
  /** 최근 7일 평균 체중 */
  weightKg?: number;
  /** 최근 체중 변화 (kg/주, 7일 평균끼리 비교) */
  trendKgPerWeek?: number;
  notes: string[];
};

/** 7일 이동평균으로 날마다 생기는 수분 변동을 걸러낸 체중 */
export function smoothedWeight(weights: DailyValue[], at: Date): number | undefined {
  const xs = weights.filter((w) => w.date <= at && at.getTime() - w.date.getTime() < 7 * DAY).map((w) => w.value);
  return xs.length ? mean(xs) : undefined;
}

export function weightTrend(weights: DailyValue[], now: Date): number | undefined {
  const cur = smoothedWeight(weights, now);
  const past = smoothedWeight(weights, new Date(now.getTime() - 14 * DAY));
  return cur !== undefined && past !== undefined ? (cur - past) / 2 : undefined;
}

/**
 * 하루 목표 섭취량.
 * - 기초대사량: Mifflin-St Jeor 공식
 * - 일상 활동 1.25배 + 오늘 운동 소모 칼로리
 * - 감량 -500kcal(기초대사량 아래로는 내리지 않음), 증량 +250kcal
 * - 단백질 감량·증량 1.6g/kg, 유지 1.2g/kg (신장 기능 저하 시 0.8g/kg)
 * - 지방 25%, 나머지 탄수화물
 */
export function nutritionTargets(input: {
  now: Date;
  profile: Profile;
  weights: DailyValue[];
  exerciseKcalToday: number;
  flags: HealthFlags;
}): NutritionTargets | null {
  const { profile, flags } = input;
  const weightKg = smoothedWeight(input.weights, input.now);
  if (!weightKg || !profile.heightCm || !profile.age || !profile.sex) return null;

  const bmr = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === "male" ? 5 : -161);
  const notes: string[] = [];
  let kcal = bmr * 1.25 + input.exerciseKcalToday;

  const trend = weightTrend(input.weights, input.now);
  if (profile.goal === "lose") {
    kcal = Math.max(bmr, kcal - 500);
    if (trend !== undefined) {
      if (trend < -0.01 * weightKg) {
        kcal += 200;
        notes.push(`체중이 주 ${Math.abs(trend).toFixed(2)}kg 씩 빠르고 있어 근손실 방지를 위해 200kcal 올렸습니다.`);
      } else if (trend > -0.1) {
        notes.push("최근 2주 체중이 거의 그대로입니다. 기록하지 않은 간식·음료가 없는지 확인해 보세요.");
      }
    }
    if (profile.targetWeightKg) notes.push(`목표까지 ${(weightKg - profile.targetWeightKg).toFixed(1)}kg`);
  } else if (profile.goal === "gain") {
    kcal += 250;
  }

  const proteinPerKg = flags.reducedKidney ? 0.8 : profile.goal === "maintain" ? 1.2 : 1.6;
  if (flags.reducedKidney) notes.push("신장 기능 수치를 고려해 단백질을 체중 1kg당 0.8g 으로 제한했습니다.");
  const proteinG = proteinPerKg * weightKg;
  const fatG = (kcal * 0.25) / 9;
  const carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);

  const sodiumMg = 2000;
  if (flags.hypertension) notes.push("혈압 관리를 위해 나트륨 2,000mg 미만을 특히 지켜주세요.");
  if (flags.glucoseConcern) notes.push("탄수화물은 통곡물·채소 위주로, 단 음료는 피하세요.");
  if (flags.highLdl) notes.push("지방은 생선·견과류·올리브유 위주로, 포화지방은 줄이세요.");

  return {
    kcal: Math.round(kcal),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
    sodiumMg,
    bmr: Math.round(bmr),
    weightKg: Math.round(weightKg * 10) / 10,
    trendKgPerWeek: trend,
    notes,
  };
}

export function remaining(t: NutritionTargets, eaten: MealTotals) {
  return {
    kcal: t.kcal - eaten.kcal,
    proteinG: t.proteinG - eaten.proteinG,
    fatG: t.fatG - eaten.fatG,
    carbsG: t.carbsG - eaten.carbsG,
    sodiumMg: t.sodiumMg - eaten.sodiumMg,
  };
}
