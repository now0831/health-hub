import type { SessionPlan } from "@health/coach";
import { loadConfig } from "./config";

/** 서버 API 호출 (SYNC_TOKEN 인증) */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = await loadConfig();
  if (!config) throw new Error("설정 탭에서 서버 주소와 토큰을 먼저 저장하세요.");
  const res = await fetch(`${config.serverUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.syncToken}`, ...init.headers },
  });
  if (res.status === 401) throw new Error("토큰이 서버의 SYNC_TOKEN 과 다릅니다.");
  if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type TodayResponse = {
  readiness: { score: number; band: string };
  plan: SessionPlan;
  nutrition: {
    targets: { kcal: number; proteinG: number };
    eaten: { kcal: number; proteinG: number };
  } | null;
  notification: { title: string; body: string } | null;
};

export type LoggedSet = { id: string; exercise: string; weightKg: number; reps: number; performedAt: string };

export const getToday = (notify = false) => api<TodayResponse>(`/api/coach/today${notify ? "?notify=1" : ""}`);
export const getTodaySets = () => api<LoggedSet[]>("/api/strength");
export const logSet = (s: { exercise: string; weightKg: number; reps: number }) =>
  api<LoggedSet>("/api/strength", { method: "POST", body: JSON.stringify(s) });
export const deleteSet = (id: string) => api<void>(`/api/strength/${id}`, { method: "DELETE" });
