import { db } from "@health/db";
import { startOfTodayKst } from "@/lib/format";

export async function getDashboardSummary() {
  const today = startOfTodayKst();

  const [weight, bodyFat, steps, restingHr, sleep, workout, activeMeds] = await Promise.all([
    db.measurement.findFirst({ where: { metric: "weight" }, orderBy: { measuredAt: "desc" } }),
    db.measurement.findFirst({ where: { metric: "body_fat" }, orderBy: { measuredAt: "desc" } }),
    db.measurement.aggregate({
      where: { metric: "steps", measuredAt: { gte: today } },
      _sum: { value: true },
    }),
    db.measurement.findFirst({ where: { metric: "resting_heart_rate" }, orderBy: { measuredAt: "desc" } }),
    db.sleepSession.findFirst({ orderBy: { startedAt: "desc" } }),
    db.workout.findFirst({ orderBy: { startedAt: "desc" } }),
    db.medication.count({ where: { active: true } }),
  ]);

  return {
    weight,
    bodyFat,
    stepsToday: steps._sum.value ?? 0,
    restingHr,
    sleep,
    workout,
    activeMeds,
  };
}
