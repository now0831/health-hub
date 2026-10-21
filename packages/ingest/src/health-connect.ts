import type { HcRecord, HealthConnectRecordType, MetricKey } from "@health/shared";
import { METRICS } from "@health/shared";
import type {
  NormalizedMeasurement,
  NormalizedRecord,
  NormalizedSleep,
  NormalizedWorkout,
  SleepStageName,
} from "./types.ts";

/**
 * Health Connect 레코드(react-native-health-connect 의 readRecords 결과)를 공통 형식으로 변환한다.
 * 레코드 구조: node_modules/react-native-health-connect/src/types/results.types.ts
 */
export function fromHealthConnect(
  recordType: HealthConnectRecordType,
  record: HcRecord,
): NormalizedRecord[] {
  const r = record as Record<string, any>;
  const source = record.metadata.dataOrigin;
  const id = record.metadata.id;

  const m = (metric: MetricKey, value: unknown, at: unknown): NormalizedMeasurement[] => {
    if (typeof value !== "number" || !Number.isFinite(value) || typeof at !== "string") return [];
    return [
      {
        kind: "measurement",
        metric,
        value,
        unit: METRICS[metric].unit,
        measuredAt: new Date(at),
        source,
        externalId: id,
      },
    ];
  };

  switch (recordType) {
    // 구간형 레코드: 구간 끝 시각을 측정 시각으로 쓴다
    case "Steps":
      return m("steps", r.count, r.endTime);
    case "Distance":
      return m("distance", r.distance?.inMeters, r.endTime);
    case "FloorsClimbed":
      return m("floors_climbed", r.floors, r.endTime);
    case "ActiveCaloriesBurned":
      return m("active_calories", r.energy?.inKilocalories, r.endTime);
    case "TotalCaloriesBurned":
      return m("total_calories", r.energy?.inKilocalories, r.endTime);

    // 심박은 샘플 단위로 저장. externalId 에 샘플 시각을 붙여 고유하게 만든다
    case "HeartRate":
      return ((r.samples ?? []) as { time: string; beatsPerMinute: number }[]).flatMap((s) =>
        m("heart_rate", s.beatsPerMinute, s.time).map((x) => ({
          ...x,
          externalId: `${id}@${s.time}`,
        })),
      );

    // 순간형 레코드
    case "RestingHeartRate":
      return m("resting_heart_rate", r.beatsPerMinute, r.time);
    case "HeartRateVariabilityRmssd":
      return m("hrv_rmssd", r.heartRateVariabilityMillis, r.time);
    case "OxygenSaturation":
      return m("spo2", r.percentage, r.time);
    case "Vo2Max":
      return m("vo2max", r.vo2MillilitersPerMinuteKilogram, r.time);
    case "Weight":
      return m("weight", r.weight?.inKilograms, r.time);
    case "BodyFat":
      return m("body_fat", r.percentage, r.time);
    case "LeanBodyMass":
      return m("lean_body_mass", r.mass?.inKilograms, r.time);
    case "BoneMass":
      return m("bone_mass", r.mass?.inKilograms, r.time);
    case "BodyWaterMass":
      return m("body_water_mass", r.mass?.inKilograms, r.time);
    case "BasalMetabolicRate":
      return m("bmr", r.basalMetabolicRate?.inKilocaloriesPerDay, r.time);

    case "ExerciseSession":
      return [exerciseSession(r, source, id)];
    case "SleepSession":
      return [sleepSession(r, source, id)];
  }
}

/** Health Connect ExerciseType 상수 중 자주 쓰는 것만 이름으로 바꾼다 */
const EXERCISE_TYPES: Record<number, string> = {
  8: "cycling",
  9: "cycling_indoor",
  37: "hiking",
  56: "running",
  57: "running_treadmill",
  70: "strength",
  74: "swimming_pool",
  79: "walking",
};

function exerciseSession(r: Record<string, any>, source: string, id: string): NormalizedWorkout {
  return {
    kind: "workout",
    sport: EXERCISE_TYPES[r.exerciseType as number] ?? "other",
    title: r.title,
    startedAt: new Date(r.startTime),
    endedAt: new Date(r.endTime),
    source,
    externalId: id,
  };
}

/** Health Connect SleepStageType 상수 */
const SLEEP_STAGES: Record<number, SleepStageName> = {
  0: "unknown",
  1: "awake",
  2: "sleeping",
  3: "awake", // OUT_OF_BED
  4: "light",
  5: "deep",
  6: "rem",
};

function sleepSession(r: Record<string, any>, source: string, id: string): NormalizedSleep {
  const stages = (r.stages ?? []) as { startTime: string; endTime: string; stage: number }[];
  return {
    kind: "sleep",
    startedAt: new Date(r.startTime),
    endedAt: new Date(r.endTime),
    stages: stages.map((s) => ({
      stage: SLEEP_STAGES[s.stage] ?? "unknown",
      start: s.startTime,
      end: s.endTime,
    })),
    source,
    externalId: id,
  };
}
