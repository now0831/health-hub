import * as Notifications from "expo-notifications";
import { getToday } from "./api";
import { loadConfig } from "./config";

type ScheduleItem = { medicationId: string; name: string; dosage: string | null; timeOfDay: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * 아침 코칭 알림. 서버가 "오늘 아직 안 보냈고 6시 이후"일 때만 내용을 돌려주므로
 * 백그라운드 동기화마다 불러도 하루 한 번만 뜬다.
 */
export async function checkMorningBriefing(): Promise<boolean> {
  const { notification } = await getToday(true);
  if (!notification) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: notification.title, body: notification.body },
    trigger: null, // 즉시
  });
  return true;
}

/**
 * 서버에 등록된 복약 일정을 받아 매일 반복 알림으로 등록한다.
 * 웹에서 약을 추가·중단한 뒤 앱에서 "알림 새로고침"을 누르면 반영된다.
 */
export async function refreshMedicationReminders(): Promise<number> {
  const config = await loadConfig();
  if (!config) throw new Error("서버 주소와 토큰을 먼저 설정하세요.");

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) throw new Error("알림 권한이 필요합니다.");

  const res = await fetch(`${config.serverUrl}/api/medications/schedule`, {
    headers: { Authorization: `Bearer ${config.syncToken}` },
  });
  if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
  const items = (await res.json()) as ScheduleItem[];

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of items) {
    const [hour, minute] = item.timeOfDay.split(":").map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💊 복약 시간",
        body: [item.name, item.dosage].filter(Boolean).join(" "),
        data: { medicationId: item.medicationId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hour!, minute: minute! },
    });
  }
  return items.length;
}
