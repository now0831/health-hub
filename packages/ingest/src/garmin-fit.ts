import { Decoder, Stream } from "@garmin/fitsdk";
import type { NormalizedWorkout, WorkoutLap } from "./types.ts";

export const GARMIN_FIT_SOURCE = "garmin-fit";

/** FIT 좌표는 semicircle 단위. 도(degree)로 바꾼다 */
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

/** 지도에 그릴 경로는 이 개수 이하로 줄인다 (DB 용량, 렌더링 속도) */
const MAX_TRACK_POINTS = 2000;

// convertDateTimesToDates 옵션(기본값)으로 대부분 Date 로 오지만, 타입상 숫자·문자열도 올 수 있다
const toDate = (v: unknown) =>
  v instanceof Date ? v : typeof v === "number" ? new Date(v) : undefined;

/**
 * Garmin Connect 에서 내보낸 활동 FIT 파일을 운동 기록으로 변환한다.
 * (Garmin Connect 웹 → 활동 → ⚙ → "원본 내보내기" 로 받은 .fit 파일)
 *
 * Health Connect 로는 넘어오지 않는 GPS 경로와 랩 기록을 얻는 용도다.
 */
export function parseGarminFit(bytes: Uint8Array): NormalizedWorkout[] {
  const stream = Stream.fromByteArray(bytes);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) throw new Error("FIT 파일이 아닙니다.");
  if (!decoder.checkIntegrity()) throw new Error("FIT 파일이 손상되었습니다 (CRC 불일치).");

  const { messages, errors } = decoder.read();
  if (errors.length > 0) throw errors[0]!;

  const laps: WorkoutLap[] = (messages.lapMesgs ?? []).map((lap) => ({
    startedAt: toDate(lap.startTime)?.toISOString() ?? "",
    durationSec: lap.totalTimerTime ?? 0,
    distanceM: lap.totalDistance,
    avgHr: lap.avgHeartRate,
    avgPaceSec:
      lap.totalDistance && lap.totalTimerTime
        ? lap.totalTimerTime / (lap.totalDistance / 1000)
        : undefined,
  }));

  const points = (messages.recordMesgs ?? [])
    .filter((r) => r.positionLat !== undefined && r.positionLong !== undefined)
    .map((r): [number, number] => [r.positionLat! * SEMICIRCLE_TO_DEG, r.positionLong! * SEMICIRCLE_TO_DEG]);
  const step = Math.max(1, Math.ceil(points.length / MAX_TRACK_POINTS));
  const track = points.filter((_, i) => i % step === 0);

  return (messages.sessionMesgs ?? []).map((s) => {
    const startedAt = toDate(s.startTime) ?? new Date();
    const elapsed = s.totalElapsedTime ?? 0;
    return {
      kind: "workout",
      sport: String(s.sport ?? "other"),
      startedAt,
      endedAt: new Date(startedAt.getTime() + elapsed * 1000),
      distanceM: s.totalDistance,
      calories: s.totalCalories,
      avgHr: s.avgHeartRate,
      maxHr: s.maxHeartRate,
      avgPaceSec:
        s.totalDistance && s.totalTimerTime ? s.totalTimerTime / (s.totalDistance / 1000) : undefined,
      laps,
      track: track.length > 0 ? track : undefined,
      source: GARMIN_FIT_SOURCE,
      // 같은 파일을 두 번 올려도 시작 시각이 같으므로 중복 저장되지 않는다
      externalId: startedAt.toISOString(),
    };
  });
}
