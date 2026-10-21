/**
 * 오늘 복용 시각이 2시간 넘게 지났는데 기록이 없는 약을 "missed" 로 기록한다.
 * 복약 순응도 통계의 기초 데이터. 하루 몇 번(예: 매시 정각) 실행하면 된다.
 *
 *   npm run mark-missed-doses -w @health/jobs
 *
 * 복용 알림 자체는 동기화 앱(apps/sync-app)이 휴대폰에서 직접 띄운다.
 */
import { db } from "@health/db";

const GRACE_MS = 2 * 3600 * 1000;
const KST_OFFSET_MS = 9 * 3600 * 1000;

const now = new Date();
const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
const todayKst = kstNow.toISOString().slice(0, 10); // YYYY-MM-DD
const weekday = kstNow.getUTCDay();

const schedules = await db.medicationSchedule.findMany({
  where: { medication: { active: true } },
  include: { medication: true },
});

let marked = 0;
for (const s of schedules) {
  if (s.daysOfWeek.length > 0 && !s.daysOfWeek.includes(weekday)) continue;

  const scheduledFor = new Date(`${todayKst}T${s.timeOfDay}:00+09:00`);
  if (scheduledFor < s.medication.startDate) continue;
  if (s.medication.endDate && scheduledFor > s.medication.endDate) continue;
  if (now.getTime() - scheduledFor.getTime() < GRACE_MS) continue;

  const result = await db.medicationLog.createMany({
    data: [{ medicationId: s.medicationId, scheduledFor, status: "missed" }],
    skipDuplicates: true, // 이미 taken/skipped 로 기록됐으면 건드리지 않는다
  });
  marked += result.count;
}

console.log(`[mark-missed-doses] ${todayKst}: ${marked}건 missed 기록`);
await db.$disconnect();
