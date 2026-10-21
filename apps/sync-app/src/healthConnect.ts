import { HEALTH_CONNECT_RECORD_TYPES, type HealthConnectRecordType } from "@health/shared";
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";

export type HealthConnectStatus = "available" | "not-installed" | "update-required";

export async function checkHealthConnect(): Promise<HealthConnectStatus> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return "not-installed";
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "update-required";
  await initialize();
  return "available";
}

/**
 * 읽기 권한 요청. app.json 의 android.permissions 와 짝이 맞아야 한다.
 * 백그라운드 읽기(자동 동기화)와 30일 이전 기록 읽기 권한도 함께 요청한다.
 */
export async function requestReadPermissions() {
  return requestPermission([
    ...HEALTH_CONNECT_RECORD_TYPES.map((recordType) => ({ accessType: "read" as const, recordType })),
    { accessType: "read", recordType: "BackgroundAccessPermission" },
    { accessType: "read", recordType: "ReadHealthDataHistory" },
  ]);
}

export async function grantedRecordTypes(): Promise<HealthConnectRecordType[]> {
  const granted = await getGrantedPermissions();
  const set = new Set(granted.filter((p) => p.accessType === "read").map((p) => p.recordType));
  return HEALTH_CONNECT_RECORD_TYPES.filter((t) => set.has(t));
}

/** 기간 안의 레코드를 페이지를 넘겨 가며 모두 읽는다 */
export async function readAll(recordType: HealthConnectRecordType, from: Date, to: Date) {
  const records = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords(recordType, {
      timeRangeFilter: { operator: "between", startTime: from.toISOString(), endTime: to.toISOString() },
      pageSize: 1000,
      pageToken,
    });
    records.push(...res.records);
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return records;
}
