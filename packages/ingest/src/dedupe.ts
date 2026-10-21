import type { MetricKey } from "@health/shared";
import type { NormalizedMeasurement, NormalizedRecord } from "./types.ts";

/** 자주 보게 될 데이터 출처 앱 패키지명 */
export const SOURCES = {
  garminConnect: "com.garmin.android.apps.connectmobile",
  samsungHealth: "com.sec.android.app.shealth",
} as const;

/**
 * 같은 항목을 여러 앱이 Health Connect 에 쓸 때 어느 앱을 믿을지 정한다.
 * 목록 앞쪽일수록 우선. 목록에 없는 출처는 맨 뒤로 간다.
 *
 * 예) 앳플리 TX 를 앳플리 앱과 삼성헬스 양쪽에 연결하면 체중이 두 번 들어온다.
 *     체성분 항목이 더 많은 앳플리 앱을 우선한다.
 *
 * TODO: 앳플리 앱의 실제 패키지명을 확인해 맨 앞에 추가하세요.
 *       동기화 앱의 "출처 앱 목록" 화면이나 /api/sync 로그에서 확인할 수 있습니다.
 */
const SOURCE_PRIORITY: Partial<Record<MetricKey, string[]>> = {
  weight: [SOURCES.samsungHealth, SOURCES.garminConnect],
  body_fat: [SOURCES.samsungHealth, SOURCES.garminConnect],
  steps: [SOURCES.garminConnect, SOURCES.samsungHealth],
  heart_rate: [SOURCES.garminConnect],
};

/**
 * 같은 항목·같은 시각(±window)에 출처만 다른 측정값이 있으면 우선순위가 높은 것만 남긴다.
 * 한 번의 동기화 묶음 안에서만 비교한다. 이미 DB 에 저장된 값과의 비교는 하지 않는다.
 */
export function dedupeMeasurements(
  records: NormalizedRecord[],
  windowMs = 2 * 60 * 1000,
): NormalizedRecord[] {
  const measurements = records.filter((r): r is NormalizedMeasurement => r.kind === "measurement");
  const others = records.filter((r) => r.kind !== "measurement");

  const rank = (r: NormalizedMeasurement) => {
    const list = SOURCE_PRIORITY[r.metric];
    const i = list?.indexOf(r.source) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const sorted = [...measurements].sort(
    (a, b) => a.metric.localeCompare(b.metric) || a.measuredAt.getTime() - b.measuredAt.getTime(),
  );

  const kept: NormalizedMeasurement[] = [];
  for (const cur of sorted) {
    // 항목→시각 순으로 정렬돼 있으므로 끝에서부터 window 안쪽만 보면 된다
    let dupIndex = -1;
    for (let i = kept.length - 1; i >= 0; i--) {
      const k = kept[i]!;
      if (k.metric !== cur.metric || cur.measuredAt.getTime() - k.measuredAt.getTime() > windowMs) break;
      if (k.source !== cur.source) {
        dupIndex = i;
        break;
      }
    }
    if (dupIndex === -1) {
      kept.push(cur);
    } else if (rank(cur) < rank(kept[dupIndex]!)) {
      kept[dupIndex] = cur;
    }
  }

  return [...kept, ...others];
}
