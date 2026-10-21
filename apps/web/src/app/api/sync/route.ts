import { db } from "@health/db";
import { dedupeMeasurements, fromHealthConnect } from "@health/ingest";
import { syncPayloadSchema, type SyncResponse } from "@health/shared";
import { verifySyncToken } from "@/lib/auth";
import { saveRecords } from "@/lib/persist";

/** 동기화 앱(apps/sync-app)이 Health Connect 데이터를 올리는 엔드포인트 */
export async function POST(request: Request) {
  if (!verifySyncToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = syncPayloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { deviceId, batches } = parsed.data;
  const received = batches.reduce((n, b) => n + b.records.length, 0);

  const normalized = dedupeMeasurements(
    batches.flatMap((b) => b.records.flatMap((r) => fromHealthConnect(b.recordType, r))),
  );
  const inserted = await saveRecords(normalized);

  await db.syncLog.create({ data: { deviceId, received, inserted } });

  return Response.json({
    received,
    inserted,
    // 심박 레코드 하나가 여러 샘플로 펼쳐지므로 received 가 아닌 변환 결과 기준으로 센다
    skipped: normalized.length - inserted,
  } satisfies SyncResponse);
}
