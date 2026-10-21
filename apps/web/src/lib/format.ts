const TZ = "Asia/Seoul";

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, dateStyle: "medium" }).format(d);

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(d);

export const formatDuration = (ms: number) => {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

/** 초 → "5:30" 또는 "1:05:30" (랩 기록용) */
export const formatClock = (sec: number) => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** 초/km → "5'30\"" */
export const formatPace = (secPerKm: number) => {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
};

/** KST 기준 오늘 0시 */
export function startOfTodayKst(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600_000);
}
