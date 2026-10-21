import type { MetricKey } from "@health/shared";

/** ingest 결과물. DB 테이블과 1:1 로 대응한다. */
export type NormalizedMeasurement = {
  kind: "measurement";
  metric: MetricKey;
  value: number;
  unit: string;
  measuredAt: Date;
  source: string;
  externalId: string;
};

export type NormalizedWorkout = {
  kind: "workout";
  sport: string;
  title?: string;
  startedAt: Date;
  endedAt: Date;
  distanceM?: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  avgPaceSec?: number;
  laps?: WorkoutLap[];
  track?: [number, number][];
  source: string;
  externalId: string;
};

export type WorkoutLap = {
  startedAt: string;
  durationSec: number;
  distanceM?: number;
  avgHr?: number;
  avgPaceSec?: number;
};

export type SleepStageName = "awake" | "light" | "deep" | "rem" | "sleeping" | "unknown";

export type NormalizedSleep = {
  kind: "sleep";
  startedAt: Date;
  endedAt: Date;
  stages: { stage: SleepStageName; start: string; end: string }[];
  source: string;
  externalId: string;
};

export type NormalizedRecord = NormalizedMeasurement | NormalizedWorkout | NormalizedSleep;
