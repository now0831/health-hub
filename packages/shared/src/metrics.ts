/**
 * 서버에 저장하는 모든 수치형 측정 항목의 정의.
 * 기기·앱이 무엇이든 ingest 단계에서 이 키와 단위로 변환해 저장한다.
 */
export const METRICS = {
  // 가민 포러너 165 → Garmin Connect → Health Connect
  steps: { label: "걸음 수", unit: "count", aggregate: "sum" },
  distance: { label: "이동 거리", unit: "m", aggregate: "sum" },
  floors_climbed: { label: "오른 층수", unit: "count", aggregate: "sum" },
  active_calories: { label: "활동 칼로리", unit: "kcal", aggregate: "sum" },
  total_calories: { label: "총 소모 칼로리", unit: "kcal", aggregate: "sum" },
  heart_rate: { label: "심박수", unit: "bpm", aggregate: "avg" },
  resting_heart_rate: { label: "안정시 심박수", unit: "bpm", aggregate: "avg" },
  hrv_rmssd: { label: "심박 변이도(RMSSD)", unit: "ms", aggregate: "avg" },
  spo2: { label: "산소포화도", unit: "%", aggregate: "avg" },
  vo2max: { label: "VO2 Max", unit: "ml/kg/min", aggregate: "last" },

  // 앳플리 TX → 앳플리 앱 → Health Connect
  weight: { label: "체중", unit: "kg", aggregate: "last" },
  body_fat: { label: "체지방률", unit: "%", aggregate: "last" },
  lean_body_mass: { label: "제지방량", unit: "kg", aggregate: "last" },
  bone_mass: { label: "골량", unit: "kg", aggregate: "last" },
  body_water_mass: { label: "체수분량", unit: "kg", aggregate: "last" },
  bmr: { label: "기초대사량", unit: "kcal/day", aggregate: "last" },

  // 수동 입력 (가정용 혈압계·혈당계 등)
  blood_pressure_systolic: { label: "수축기 혈압", unit: "mmHg", aggregate: "avg" },
  blood_pressure_diastolic: { label: "이완기 혈압", unit: "mmHg", aggregate: "avg" },
  blood_glucose: { label: "혈당", unit: "mg/dL", aggregate: "avg" },
} as const satisfies Record<
  string,
  { label: string; unit: string; aggregate: "sum" | "avg" | "last" }
>;

export type MetricKey = keyof typeof METRICS;

export const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];
