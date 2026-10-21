/**
 * 국가건강검진 주요 항목의 이름과 단위.
 * 정상·주의·이상 판정 기준은 @health/coach 의 doctor.ts(assessItem) 한 곳에서만 관리한다.
 */
export type CheckupItem = { label: string; unit: string };

export const CHECKUP_ITEMS = {
  bmi: { label: "체질량지수", unit: "kg/m²" },
  waist: { label: "허리둘레", unit: "cm" },
  systolic_bp: { label: "수축기 혈압", unit: "mmHg" },
  diastolic_bp: { label: "이완기 혈압", unit: "mmHg" },
  fasting_glucose: { label: "공복혈당", unit: "mg/dL" },
  hba1c: { label: "당화혈색소", unit: "%" },
  total_cholesterol: { label: "총콜레스테롤", unit: "mg/dL" },
  hdl: { label: "HDL 콜레스테롤", unit: "mg/dL" },
  ldl: { label: "LDL 콜레스테롤", unit: "mg/dL" },
  triglycerides: { label: "중성지방", unit: "mg/dL" },
  hemoglobin: { label: "혈색소", unit: "g/dL" },
  ast: { label: "AST", unit: "U/L" },
  alt: { label: "ALT", unit: "U/L" },
  ggt: { label: "감마지티피", unit: "U/L" },
  creatinine: { label: "혈청 크레아티닌", unit: "mg/dL" },
  egfr: { label: "신사구체여과율", unit: "mL/min/1.73m²" },
} as const satisfies Record<string, CheckupItem>;

export type CheckupItemKey = keyof typeof CHECKUP_ITEMS;
