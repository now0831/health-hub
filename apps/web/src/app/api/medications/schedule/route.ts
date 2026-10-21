import { db } from "@health/db";
import { verifySyncToken } from "@/lib/auth";

/** 동기화 앱이 복약 알림을 등록할 때 쓰는 일정 목록 */
export async function GET(request: Request) {
  if (!verifySyncToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const schedules = await db.medicationSchedule.findMany({
    where: { medication: { active: true } },
    include: { medication: true },
    orderBy: { timeOfDay: "asc" },
  });

  return Response.json(
    schedules.map((s) => ({
      medicationId: s.medicationId,
      name: s.medication.name,
      dosage: s.medication.dosage,
      timeOfDay: s.timeOfDay,
    })),
  );
}
