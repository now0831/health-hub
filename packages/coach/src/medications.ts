/**
 * 흔히 쓰는 만성질환 약의 계열 판별과, 운동·식단·검사와 관련된 일반적인 주의점.
 * 일반 의학 정보 수준이며 처방을 대신하지 않는다. 판별은 성분명(ingredient) → 약 이름 순으로 키워드를 찾는다.
 */
export type DrugClass =
  | "statin"
  | "metformin"
  | "sulfonylurea"
  | "insulin"
  | "sglt2"
  | "betaBlocker"
  | "ccb"
  | "arb"
  | "aceInhibitor"
  | "thiazide"
  | "antiplatelet"
  | "anticoagulant"
  | "levothyroxine"
  | "ppi";

export type DrugInfo = {
  label: string;
  /** 성분명·대표 제품명 키워드 (소문자 비교) */
  keywords: string[];
  /** 이 약과 관련해 검진에서 함께 볼 항목 (@health/shared CHECKUP_ITEMS 키) */
  monitor: string[];
  exercise?: string;
  nutrition?: string;
  ask?: string;
};

export const DRUG_CLASSES: Record<DrugClass, DrugInfo> = {
  statin: {
    label: "스타틴 (콜레스테롤약)",
    keywords: ["atorvastatin", "rosuvastatin", "pitavastatin", "simvastatin", "pravastatin", "아토르바스타틴", "로수바스타틴", "피타바스타틴", "리피토", "크레스토", "리바로"],
    monitor: ["ldl", "total_cholesterol", "ast", "alt"],
    exercise: "원인 모를 근육통·쇠약감이 운동 후에도 계속되면 진료 때 알리세요.",
    ask: "LDL 목표치가 내 위험도에 맞는지",
  },
  metformin: {
    label: "메트포르민 (당뇨약)",
    keywords: ["metformin", "메트포르민", "다이아벡스", "글루코파지"],
    monitor: ["fasting_glucose", "hba1c", "egfr", "creatinine"],
    nutrition: "장기 복용 시 비타민 B12 가 부족해질 수 있습니다.",
    ask: "비타민 B12 검사가 필요한지",
  },
  sulfonylurea: {
    label: "설포닐우레아 (당뇨약)",
    keywords: ["glimepiride", "gliclazide", "glipizide", "글리메피리드", "글리클라지드", "아마릴"],
    monitor: ["fasting_glucose", "hba1c"],
    exercise: "운동 중·후 저혈당 위험이 있습니다. 공복 고강도 운동을 피하고 사탕 등 당분을 챙기세요.",
  },
  insulin: {
    label: "인슐린",
    keywords: ["insulin", "인슐린", "란투스", "트레시바", "노보래피드", "휴마로그"],
    monitor: ["fasting_glucose", "hba1c"],
    exercise: "운동 전후 혈당을 확인하고 저혈당 대비 당분을 챙기세요.",
  },
  sglt2: {
    label: "SGLT2 억제제 (당뇨약)",
    keywords: ["dapagliflozin", "empagliflozin", "다파글리플로진", "엠파글리플로진", "포시가", "자디앙스"],
    monitor: ["hba1c", "egfr"],
    exercise: "소변으로 수분이 빠지므로 운동 중 물을 충분히 드세요.",
  },
  betaBlocker: {
    label: "베타차단제 (혈압·심장약)",
    keywords: ["bisoprolol", "carvedilol", "nebivolol", "atenolol", "metoprolol", "propranolol", "비소프롤롤", "카르베딜롤", "네비보롤", "콩코르", "딜라트렌", "네비레트"],
    monitor: ["systolic_bp", "diastolic_bp"],
    exercise: "심박수가 덜 오르므로 심박 구간 대신 체감 강도(RPE)로 운동 강도를 맞춥니다.",
  },
  ccb: {
    label: "칼슘채널차단제 (혈압약)",
    keywords: ["amlodipine", "nifedipine", "암로디핀", "노바스크"],
    monitor: ["systolic_bp", "diastolic_bp"],
    exercise: "운동 직후 갑자기 멈추면 어지러울 수 있으니 정리운동을 충분히 하세요.",
  },
  arb: {
    label: "ARB (혈압약)",
    keywords: ["losartan", "valsartan", "telmisartan", "olmesartan", "candesartan", "로사르탄", "발사르탄", "텔미사르탄", "올메사르탄", "코자", "디오반", "미카르디스", "올메텍"],
    monitor: ["systolic_bp", "diastolic_bp", "creatinine", "egfr"],
    ask: "칼륨 수치 확인이 필요한지",
  },
  aceInhibitor: {
    label: "ACE 억제제 (혈압약)",
    keywords: ["ramipril", "perindopril", "enalapril", "라미프릴", "페린도프릴"],
    monitor: ["systolic_bp", "diastolic_bp", "creatinine", "egfr"],
    ask: "칼륨 수치 확인이 필요한지",
  },
  thiazide: {
    label: "이뇨제 (혈압약)",
    keywords: ["hydrochlorothiazide", "indapamide", "chlorthalidone", "히드로클로로티아지드", "인다파미드"],
    monitor: ["systolic_bp", "diastolic_bp"],
    exercise: "더운 날 장시간 운동 시 탈수에 주의하세요.",
  },
  antiplatelet: {
    label: "항혈소판제",
    keywords: ["aspirin", "clopidogrel", "아스피린", "클로피도그렐", "플라빅스"],
    monitor: [],
    exercise: "멍이 잘 들 수 있습니다. 넘어질 위험이 큰 운동은 조심하세요.",
  },
  anticoagulant: {
    label: "항응고제",
    keywords: ["warfarin", "apixaban", "rivaroxaban", "edoxaban", "dabigatran", "와파린", "엘리퀴스", "자렐토", "릭시아나"],
    monitor: ["hemoglobin"],
    exercise: "출혈 위험이 있어 부딪히거나 넘어질 수 있는 운동은 피하세요.",
    nutrition: "와파린은 비타민 K 섭취량(녹색 채소)을 갑자기 바꾸지 않는 것이 좋습니다.",
  },
  levothyroxine: {
    label: "갑상선호르몬제",
    keywords: ["levothyroxine", "레보티록신", "씬지로이드", "씬지록신"],
    monitor: [],
    nutrition: "아침 공복에 복용하고, 칼슘·철분제와는 시간 간격을 두세요.",
  },
  ppi: {
    label: "위산분비억제제 (PPI)",
    keywords: ["omeprazole", "esomeprazole", "lansoprazole", "pantoprazole", "rabeprazole", "오메프라졸", "에소메프라졸", "넥시움", "란소프라졸"],
    monitor: [],
    nutrition: "장기 복용 시 비타민 B12·마그네슘이 부족해질 수 있습니다.",
  },
};

export type MedicationInput = { name: string; ingredient?: string | null; dosage?: string | null };

export function classifyMedication(m: MedicationInput): DrugClass | undefined {
  const haystacks = [m.ingredient, m.name].filter(Boolean).map((s) => s!.toLowerCase());
  for (const hay of haystacks) {
    for (const [cls, info] of Object.entries(DRUG_CLASSES) as [DrugClass, DrugInfo][]) {
      if (info.keywords.some((k) => hay.includes(k.toLowerCase()))) return cls;
    }
  }
  return undefined;
}
