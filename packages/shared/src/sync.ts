import { z } from "zod";

/**
 * 동기화 앱 → 서버(/api/sync) 전송 형식.
 *
 * 앱은 Health Connect 레코드를 가공하지 않고 그대로 보낸다.
 * 변환은 서버의 @health/ingest 가 담당하므로, 매핑 규칙을 고쳐도 앱을 다시 배포할 필요가 없다.
 */
export const HEALTH_CONNECT_RECORD_TYPES = [
  "Steps",
  "Distance",
  "FloorsClimbed",
  "ActiveCaloriesBurned",
  "TotalCaloriesBurned",
  "HeartRate",
  "RestingHeartRate",
  "HeartRateVariabilityRmssd",
  "OxygenSaturation",
  "Vo2Max",
  "Weight",
  "BodyFat",
  "LeanBodyMass",
  "BoneMass",
  "BodyWaterMass",
  "BasalMetabolicRate",
  "ExerciseSession",
  "SleepSession",
] as const;

export type HealthConnectRecordType = (typeof HEALTH_CONNECT_RECORD_TYPES)[number];

/** 모든 Health Connect 레코드가 공통으로 갖는 메타데이터 */
const hcMetadata = z.object({
  id: z.string(),
  /** 데이터를 쓴 앱의 패키지명 (예: com.garmin.android.apps.connectmobile) */
  dataOrigin: z.string(),
  lastModifiedTime: z.string().optional(),
});

/** 레코드 본문은 타입마다 다르므로 ingest 단계에서 타입별로 검증한다 */
export const hcRecordSchema = z.looseObject({ metadata: hcMetadata });

export const syncPayloadSchema = z.object({
  deviceId: z.string().min(1),
  batches: z.array(
    z.object({
      recordType: z.enum(HEALTH_CONNECT_RECORD_TYPES),
      records: z.array(hcRecordSchema),
    }),
  ),
});

export type SyncPayload = z.infer<typeof syncPayloadSchema>;
export type HcRecord = z.infer<typeof hcRecordSchema>;

export const syncResponseSchema = z.object({
  /** 받은 Health Connect 레코드 수 */
  received: z.number(),
  /** 새로 저장(또는 갱신)된 행 수 */
  inserted: z.number(),
  /** 이미 저장돼 있거나 중복이라 건너뛴 행 수 */
  skipped: z.number(),
});

export type SyncResponse = z.infer<typeof syncResponseSchema>;
