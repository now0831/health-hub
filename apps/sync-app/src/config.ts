import * as SecureStore from "expo-secure-store";

/** 앱 설정과 동기화 상태. 토큰이 들어 있으므로 SecureStore(암호화 저장소)에 둔다 */
const KEYS = {
  serverUrl: "serverUrl",
  syncToken: "syncToken",
  lastSyncAt: "lastSyncAt",
  deviceId: "deviceId",
} as const;

export type AppConfig = { serverUrl: string; syncToken: string };

export async function loadConfig(): Promise<AppConfig | null> {
  const [serverUrl, syncToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.serverUrl),
    SecureStore.getItemAsync(KEYS.syncToken),
  ]);
  return serverUrl && syncToken ? { serverUrl, syncToken } : null;
}

export async function saveConfig({ serverUrl, syncToken }: AppConfig) {
  await SecureStore.setItemAsync(KEYS.serverUrl, serverUrl.replace(/\/+$/, ""));
  await SecureStore.setItemAsync(KEYS.syncToken, syncToken.trim());
}

/** 마지막으로 성공한 동기화 시각. 처음이면 null */
export async function getLastSyncAt(): Promise<Date | null> {
  const v = await SecureStore.getItemAsync(KEYS.lastSyncAt);
  return v ? new Date(v) : null;
}

export async function setLastSyncAt(at: Date) {
  await SecureStore.setItemAsync(KEYS.lastSyncAt, at.toISOString());
}

export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(KEYS.deviceId);
  if (!id) {
    id = `android-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(KEYS.deviceId, id);
  }
  return id;
}
