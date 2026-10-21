import { nutritionTargets, planDay, remaining, type DailyCoaching, type NutritionTargets } from "@health/coach";
import { db, type Prisma } from "@health/db";
import { loadAll, loadMealTotals } from "./inputs";

const DAY = 24 * 3600_000;

export type TodayCoaching = Awaited<ReturnType<typeof getTodayCoaching>>;

/**
 * 오늘의 코칭을 계산하고 DailyPlan 에 저장한다.
 * 데이터(동기화, 컨디션 체크, 식단)가 바뀔 때마다 다시 계산되며, 알림 발송 시각은 유지된다.
 */
export async function getTodayCoaching(now = new Date()) {
  const all = await loadAll(now);
  const coaching: DailyCoaching = planDay(all.coachInput);
  const targets: NutritionTargets | null = nutritionTargets({
    now,
    profile: all.profile,
    weights: all.weights,
    exerciseKcalToday: all.exerciseKcalToday,
    flags: all.doctor.flags,
  });
  const eaten = await loadMealTotals(all.today, new Date(all.today.getTime() + DAY));

  await db.dailyPlan.upsert({
    where: { date: all.today },
    create: { date: all.today, readiness: coaching.readiness.score, data: coaching as unknown as Prisma.InputJsonValue },
    update: { readiness: coaching.readiness.score, data: coaching as unknown as Prisma.InputJsonValue },
  });

  return {
    coaching,
    nutrition: targets ? { targets, eaten, remaining: remaining(targets, eaten) } : null,
    doctor: all.doctor,
    profile: all.profile,
    checkIn: all.checkIn,
    profileComplete: Boolean(all.profile.age && all.profile.sex && all.profile.heightCm),
  };
}

/** 아침 알림 문구 (동기화 앱이 받아서 띄운다) */
export function notificationText(c: DailyCoaching) {
  const r = c.readiness;
  return {
    title: `회복 ${r.score}점 · ${c.plan.title}`,
    body: c.plan.summary,
  };
}
