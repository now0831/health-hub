/**
 * 지난 7일 요약을 출력한다. 나중에 이메일·카카오톡 알림 등으로 보내도록 확장하면 된다.
 *
 *   npm run weekly-report -w @health/jobs
 */
import { db } from "@health/db";

const DAY = 24 * 3600 * 1000;
const since = new Date(Date.now() - 7 * DAY);

const [steps, restingHr, weights, workouts, sleeps] = await Promise.all([
  db.measurement.aggregate({ where: { metric: "steps", measuredAt: { gte: since } }, _sum: { value: true } }),
  db.measurement.aggregate({
    where: { metric: "resting_heart_rate", measuredAt: { gte: since } },
    _avg: { value: true },
  }),
  db.measurement.findMany({
    where: { metric: "weight", measuredAt: { gte: since } },
    orderBy: { measuredAt: "asc" },
  }),
  db.workout.findMany({ where: { startedAt: { gte: since } } }),
  db.sleepSession.findMany({ where: { startedAt: { gte: since } } }),
]);

const runKm = workouts
  .filter((w) => w.sport.startsWith("running"))
  .reduce((km, w) => km + (w.distanceM ?? 0) / 1000, 0);
const avgSleepH =
  sleeps.length > 0
    ? sleeps.reduce((h, s) => h + (s.endedAt.getTime() - s.startedAt.getTime()) / 3600_000, 0) / sleeps.length
    : null;
const weightChange =
  weights.length >= 2 ? weights.at(-1)!.value - weights[0]!.value : null;

console.log(`# 주간 건강 리포트 (${since.toISOString().slice(0, 10)} ~)`);
console.log(`- 걸음 수: 하루 평균 ${Math.round((steps._sum.value ?? 0) / 7).toLocaleString("ko-KR")}보`);
console.log(`- 운동: ${workouts.length}회, 러닝 ${runKm.toFixed(1)} km`);
console.log(`- 안정시 심박수 평균: ${restingHr._avg.value ? Math.round(restingHr._avg.value) + " bpm" : "—"}`);
console.log(`- 평균 수면: ${avgSleepH ? avgSleepH.toFixed(1) + "시간" : "—"}`);
console.log(`- 체중 변화: ${weightChange !== null ? (weightChange >= 0 ? "+" : "") + weightChange.toFixed(1) + " kg" : "—"}`);

await db.$disconnect();
