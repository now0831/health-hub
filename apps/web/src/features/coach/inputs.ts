import {
  buildDoctorReport,
  isExerciseKey,
  restingHrFromSamples,
  startOfDay,
  type CheckupRecord,
  type CoachInput,
  type DailyValue,
  type Lifestyle,
  type MealTotals,
  type MuscleGroup,
  type Profile,
  type SleepNight,
  type WorkoutSummary,
  weightTrend,
} from "@health/coach";
import { db } from "@health/db";

const DAY = 24 * 3600_000;

export async function loadProfile(): Promise<Profile & { raw: Awaited<ReturnType<typeof db.profile.findUnique>> }> {
  const p = await db.profile.findUnique({ where: { id: "me" } });
  const thisYear = new Date().getFullYear();
  return {
    raw: p,
    age: p?.birthYear ? thisYear - p.birthYear : undefined,
    sex: p?.sex === "male" || p?.sex === "female" ? p.sex : undefined,
    heightCm: p?.heightCm ?? undefined,
    targetWeightKg: p?.targetWeightKg ?? undefined,
    goal: p?.goal === "lose" || p?.goal === "gain" ? p.goal : "maintain",
    maxHr: p?.maxHr ?? undefined,
    dumbbellsKg: p?.dumbbellsKg ?? [],
    hasPullUpBar: p?.hasPullUpBar ?? false,
    hasIndoorBike: p?.hasIndoorBike ?? false,
    weeklyRuns: p?.weeklyRuns ?? 3,
    weeklyRides: p?.weeklyRides ?? 1,
    weeklyStrength: p?.weeklyStrength ?? 2,
  };
}

async function loadSleeps(since: Date): Promise<SleepNight[]> {
  const rows = await db.sleepSession.findMany({ where: { startedAt: { gte: since } }, orderBy: { startedAt: "asc" } });
  return rows.map((s) => {
    const stages = (s.stages as { stage: string; start: string; end: string }[] | null) ?? [];
    const dur = (x: { start: string; end: string }) => Date.parse(x.end) - Date.parse(x.start);
    const total = stages.filter((x) => x.stage !== "awake").reduce((a, x) => a + dur(x), 0);
    const deepRem = stages.filter((x) => x.stage === "deep" || x.stage === "rem").reduce((a, x) => a + dur(x), 0);
    return { start: s.startedAt, end: s.endedAt, deepRemRatio: total > 0 && deepRem > 0 ? deepRem / total : undefined };
  });
}

/** 날짜(KST)별 마지막 값 */
function perDay(rows: { measuredAt: Date; value: number }[]): DailyValue[] {
  const m = new Map<number, DailyValue>();
  for (const r of rows) m.set(startOfDay(r.measuredAt).getTime(), { date: r.measuredAt, value: r.value });
  return [...m.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * 밤사이 안정시 심박. Health Connect 에 RestingHeartRate 가 있으면 그 값을,
 * 없으면 수면 중 심박 샘플로 계산한다.
 */
async function loadRestingHr(sleeps: SleepNight[], since: Date): Promise<DailyValue[]> {
  const direct = await db.measurement.findMany({
    where: { metric: "resting_heart_rate", measuredAt: { gte: since } },
    orderBy: { measuredAt: "asc" },
    select: { measuredAt: true, value: true },
  });
  const byDay = new Map(perDay(direct).map((v) => [startOfDay(v.date).getTime(), v]));

  const samples = await db.measurement.findMany({
    where: { metric: "heart_rate", measuredAt: { gte: since } },
    select: { measuredAt: true, value: true },
  });
  const pts = samples.map((s) => ({ time: s.measuredAt, bpm: s.value }));
  for (const night of sleeps) {
    const key = startOfDay(night.end).getTime();
    if (byDay.has(key)) continue;
    const bpm = restingHrFromSamples(pts, night);
    if (bpm !== undefined) byDay.set(key, { date: night.end, value: bpm });
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function loadMealTotals(from: Date, to: Date): Promise<MealTotals> {
  const agg = await db.mealEntry.aggregate({
    where: { eatenAt: { gte: from, lt: to } },
    _sum: { kcal: true, proteinG: true, fatG: true, carbsG: true, sodiumMg: true },
  });
  return {
    kcal: agg._sum.kcal ?? 0,
    proteinG: agg._sum.proteinG ?? 0,
    fatG: agg._sum.fatG ?? 0,
    carbsG: agg._sum.carbsG ?? 0,
    sodiumMg: agg._sum.sodiumMg ?? 0,
  };
}

export async function loadDoctorInputs(profile: Profile, workouts: WorkoutSummary[], sleeps: SleepNight[], restingHr: DailyValue[], weights: DailyValue[]) {
  const now = new Date();
  const [checkups, meds, mealDays] = await Promise.all([
    db.checkup.findMany({ include: { results: true }, orderBy: { date: "desc" } }),
    db.medication.findMany({ where: { active: true } }),
    db.mealEntry.findMany({
      where: { eatenAt: { gte: new Date(now.getTime() - 14 * DAY) } },
      select: { eatenAt: true, sodiumMg: true },
    }),
  ]);

  const recent4w = workouts.filter((w) => w.startedAt.getTime() > now.getTime() - 28 * DAY);
  const aerobic = recent4w.filter((w) => /^(running|cycling|walking|hiking)/.test(w.sport));
  const sleepHours = sleeps
    .filter((s) => s.end.getTime() > now.getTime() - 14 * DAY)
    .map((s) => (s.end.getTime() - s.start.getTime()) / 3600_000);
  const rhrNow = restingHr.filter((v) => v.date.getTime() > now.getTime() - 7 * DAY).map((v) => v.value);
  const rhrPast = restingHr
    .filter((v) => v.date.getTime() < now.getTime() - 28 * DAY && v.date.getTime() > now.getTime() - 35 * DAY)
    .map((v) => v.value);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

  const sodiumByDay = new Map<number, number>();
  for (const d of mealDays) {
    const k = startOfDay(d.eatenAt).getTime();
    sodiumByDay.set(k, (sodiumByDay.get(k) ?? 0) + d.sodiumMg);
  }

  const lifestyle: Lifestyle = {
    weeklyAerobicMin: workouts.length ? aerobic.reduce((a, w) => a + w.durationMin, 0) / 4 : undefined,
    avgSleepHours: avg(sleepHours),
    restingHrTrend: avg(rhrNow) !== undefined && avg(rhrPast) !== undefined ? { now: avg(rhrNow)!, monthAgo: avg(rhrPast)! } : undefined,
    weightTrendKgPerWeek: weightTrend(weights, now),
    avgSodiumMg: avg([...sodiumByDay.values()]),
  };

  const checkupRecords: CheckupRecord[] = checkups.map((c) => ({
    date: c.date,
    results: c.results.map((r) => ({ item: r.item, value: r.value, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh })),
  }));

  return buildDoctorReport({
    checkups: checkupRecords,
    medications: meds.map((m) => ({ name: m.name, ingredient: m.ingredient, dosage: m.dosage })),
    sex: profile.sex,
    lifestyle,
  });
}

/** 코치·주치의가 쓰는 모든 데이터를 한 번에 읽는다 */
export async function loadAll(now = new Date()) {
  const today = startOfDay(now);
  const since42 = new Date(today.getTime() - 42 * DAY);
  const since60 = new Date(today.getTime() - 60 * DAY);

  const profile = await loadProfile();
  const [sleeps, workoutsRaw, sets, checkInRow, weightRows, hrvRows] = await Promise.all([
    loadSleeps(since42),
    db.workout.findMany({ where: { startedAt: { gte: since42 } }, orderBy: { startedAt: "asc" } }),
    db.strengthSet.findMany({ where: { performedAt: { gte: new Date(today.getTime() - 28 * DAY) } } }),
    db.dailyCheckIn.findUnique({ where: { date: today } }),
    db.measurement.findMany({ where: { metric: "weight", measuredAt: { gte: since60 } }, orderBy: { measuredAt: "asc" }, select: { measuredAt: true, value: true } }),
    db.measurement.findMany({ where: { metric: "hrv_rmssd", measuredAt: { gte: since42 } }, orderBy: { measuredAt: "asc" }, select: { measuredAt: true, value: true } }),
  ]);
  const restingHr = await loadRestingHr(sleeps, since42);

  const workouts: WorkoutSummary[] = workoutsRaw.map((w) => ({
    sport: w.sport,
    startedAt: w.startedAt,
    durationMin: (w.endedAt.getTime() - w.startedAt.getTime()) / 60_000,
    distanceM: w.distanceM ?? undefined,
    avgHr: w.avgHr ?? undefined,
    calories: w.calories ?? undefined,
  }));
  const weights = weightRows.map((r) => ({ date: r.measuredAt, value: r.value }));

  const doctor = await loadDoctorInputs(profile, workouts, sleeps, restingHr, weights);

  const coachInput: CoachInput = {
    now,
    profile,
    sleeps,
    restingHr,
    hrv: perDay(hrvRows),
    workouts,
    strengthSets: sets.filter((s) => isExerciseKey(s.exercise)),
    checkIn: checkInRow
      ? { energy: checkInRow.energy, stress: checkInRow.stress, soreness: checkInRow.soreness as MuscleGroup[] }
      : undefined,
    flags: doctor.flags,
  };

  // 운동으로 쓴 칼로리만 더한다. (Garmin 활동 칼로리에는 일상 걷기도 포함돼 기본 활동계수와 겹친다)
  // 근력 세트는 세트당 약 7kcal 로 추정
  const exerciseKcalToday =
    workouts.filter((w) => w.startedAt >= today).reduce((a, w) => a + (w.calories ?? w.durationMin * 7), 0) +
    sets.filter((s) => s.performedAt >= today).length * 7;

  return { profile, coachInput, doctor, weights, exerciseKcalToday, today, checkIn: checkInRow };
}
