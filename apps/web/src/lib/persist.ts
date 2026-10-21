import { db } from "@health/db";
import { GARMIN_FIT_SOURCE, type NormalizedRecord } from "@health/ingest";

/** 시작 시각 차이가 이 안쪽이면 같은 운동으로 본다 */
const WORKOUT_MATCH_MS = 2 * 60 * 1000;

/** ingest 결과에서 구분용 kind 필드를 떼어 DB 입력 형태로 만든다 */
function toRow<T extends { kind: string }>({ kind, ...row }: T): Omit<T, "kind"> {
  void kind;
  return row;
}

/**
 * ingest 결과를 DB 에 저장한다.
 * (source, externalId) 가 같은 레코드는 이미 저장된 것으로 보고 건너뛴다.
 */
export async function saveRecords(records: NormalizedRecord[]): Promise<number> {
  let inserted = 0;

  const measurements = records.filter((r) => r.kind === "measurement");
  if (measurements.length > 0) {
    const { count } = await db.measurement.createMany({
      data: measurements.map(toRow),
      skipDuplicates: true,
    });
    inserted += count;
  }

  for (const r of records) {
    const where = { source_externalId: { source: r.source, externalId: r.externalId } };
    if (r.kind === "workout") {
      const data = toRow(r);
      // 같은 러닝이 Health Connect(요약)와 FIT 파일(상세)로 각각 들어올 수 있다.
      // 시작 시각이 비슷한 운동이 이미 있으면 하나로 합친다.
      const sameRun = await db.workout.findFirst({
        where: {
          startedAt: {
            gte: new Date(r.startedAt.getTime() - WORKOUT_MATCH_MS),
            lte: new Date(r.startedAt.getTime() + WORKOUT_MATCH_MS),
          },
          NOT: { source: r.source, externalId: r.externalId },
        },
      });
      if (sameRun) {
        // FIT 이 더 자세하므로 FIT 이 오면 덮어쓰고, 그 외에는 기존 기록을 유지한다
        if (r.source === GARMIN_FIT_SOURCE) {
          await db.workout.update({ where: { id: sameRun.id }, data: { ...data, title: sameRun.title ?? data.title } });
          inserted++;
        }
        continue;
      }
      await db.workout.upsert({ where, create: data, update: data });
      inserted++;
    } else if (r.kind === "sleep") {
      const data = toRow(r);
      await db.sleepSession.upsert({ where, create: data, update: data });
      inserted++;
    }
  }

  return inserted;
}
