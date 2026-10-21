import type { HcRecord, SyncPayload, SyncResponse } from "@health/shared";
import { getDeviceId, getLastSyncAt, loadConfig, setLastSyncAt } from "./config";
import { grantedRecordTypes, readAll } from "./healthConnect";

const DAY = 24 * 3600 * 1000;

/** 처음 동기화할 때 가져올 기간 */
const INITIAL_DAYS = 90;
/**
 * 매번 다시 훑어보는 기간. 가민 앱이 시계 데이터를 늦게 올려도(며칠 동안 폰과 연결 안 됨 등) 놓치지 않게 한다.
 * 이 중 마지막 동기화 이후 수정된 레코드만 서버로 보낸다.
 */
const LOOKBACK_DAYS = 7;
/** 한 번의 요청에 담는 최대 레코드 수 */
const CHUNK = 2000;

export type SyncResult = SyncResponse & { origins: string[] };

export async function runSync(): Promise<SyncResult> {
  const config = await loadConfig();
  if (!config) throw new Error("서버 주소와 토큰을 먼저 설정하세요.");

  const now = new Date();
  const lastSyncAt = await getLastSyncAt();
  const from = new Date(now.getTime() - (lastSyncAt ? LOOKBACK_DAYS : INITIAL_DAYS) * DAY);
  // 시계 오차를 감안해 10분 여유를 둔다
  const modifiedAfter = lastSyncAt ? lastSyncAt.getTime() - 10 * 60 * 1000 : 0;

  const deviceId = await getDeviceId();
  const origins = new Set<string>();
  const total: SyncResponse = { received: 0, inserted: 0, skipped: 0 };

  for (const recordType of await grantedRecordTypes()) {
    const records = (await readAll(recordType, from, now)) as unknown as HcRecord[];
    const changed = records.filter((r) => {
      origins.add(r.metadata.dataOrigin);
      const modified = r.metadata.lastModifiedTime ? Date.parse(r.metadata.lastModifiedTime) : Infinity;
      return modified >= modifiedAfter;
    });

    for (let i = 0; i < changed.length; i += CHUNK) {
      const res = await post(config, {
        deviceId,
        batches: [{ recordType, records: changed.slice(i, i + CHUNK) }],
      });
      total.received += res.received;
      total.inserted += res.inserted;
      total.skipped += res.skipped;
    }
  }

  await setLastSyncAt(now);
  return { ...total, origins: [...origins].sort() };
}

async function post(
  config: { serverUrl: string; syncToken: string },
  payload: SyncPayload,
): Promise<SyncResponse> {
  const res = await fetch(`${config.serverUrl}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.syncToken}` },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("토큰이 서버의 SYNC_TOKEN 과 다릅니다.");
  if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
  return (await res.json()) as SyncResponse;
}
