import { startOfDay } from "@health/coach";
import { db } from "@health/db";
import { verifySyncToken } from "@/lib/auth";
import { getTodayCoaching, notificationText } from "@/features/coach/today";

/** 아침 알림을 보내기 시작하는 시각 (KST) */
const NOTIFY_FROM_HOUR = 6;

/**
 * 동기화 앱용 오늘의 코칭.
 * ?notify=1 이면 오늘 아직 알림을 안 보냈고 6시 이후일 때 notification 을 함께 돌려주고 발송 기록을 남긴다.
 */
export async function GET(request: Request) {
  if (!verifySyncToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const t = await getTodayCoaching(now);

  let notification: { title: string; body: string } | null = null;
  if (new URL(request.url).searchParams.get("notify") === "1") {
    const kstHour = new Date(now.getTime() + 9 * 3600_000).getUTCHours();
    const date = startOfDay(now);
    if (kstHour >= NOTIFY_FROM_HOUR) {
      // 동시에 두 번 호출돼도 한 번만 보내도록 조건부 갱신
      const { count } = await db.dailyPlan.updateMany({ where: { date, notifiedAt: null }, data: { notifiedAt: now } });
      if (count > 0) notification = notificationText(t.coaching);
    }
  }

  return Response.json({
    readiness: { score: t.coaching.readiness.score, band: t.coaching.readiness.band },
    plan: t.coaching.plan,
    nutrition: t.nutrition,
    notification,
  });
}
