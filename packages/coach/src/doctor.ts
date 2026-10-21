import { CHECKUP_ITEMS, type CheckupItemKey } from "@health/shared";
import { DRUG_CLASSES, classifyMedication, type DrugClass, type MedicationInput } from "./medications.ts";
import type { Sex } from "./types.ts";

/**
 * 건강검진 결과 + 복용 약 + 기기 데이터를 규칙으로 종합한다.
 * 판정 기준은 국가건강검진 결과 판정 기준과 국내 진료지침의 일반적인 구간을 따랐다.
 * 진단이 아니라 "다음 진료 때 무엇을 확인할지" 정리하는 용도다.
 */

export type CheckupRecord = {
  date: Date;
  results: { item: string; value: number | null; unit?: string | null; refLow?: number | null; refHigh?: number | null }[];
};

export type Severity = "normal" | "caution" | "high" | "low";

type Threshold = { caution?: number; high?: number; low?: number; cautionLabel?: string; highLabel?: string; lowLabel?: string };

/** 항목별 주의·이상 구간. 값이 caution 이상이면 주의, high 이상이면 이상 */
const THRESHOLDS: Partial<Record<CheckupItemKey, Threshold | ((sex?: Sex) => Threshold)>> = {
  bmi: { caution: 23, high: 25, low: 18.5, cautionLabel: "과체중", highLabel: "비만", lowLabel: "저체중" },
  waist: (sex) => ({ high: sex === "female" ? 85 : 90, highLabel: "복부비만" }),
  systolic_bp: { caution: 120, high: 140, cautionLabel: "주의혈압", highLabel: "고혈압 의심" },
  diastolic_bp: { caution: 80, high: 90, cautionLabel: "주의혈압", highLabel: "고혈압 의심" },
  fasting_glucose: { caution: 100, high: 126, cautionLabel: "공복혈당장애", highLabel: "당뇨병 의심" },
  hba1c: { caution: 5.7, high: 6.5, cautionLabel: "당뇨 전단계", highLabel: "당뇨병 의심" },
  total_cholesterol: { caution: 200, high: 240, cautionLabel: "경계", highLabel: "높음" },
  ldl: { caution: 130, high: 160, cautionLabel: "경계", highLabel: "높음" },
  hdl: { low: 40, lowLabel: "낮음" },
  triglycerides: { caution: 150, high: 200, cautionLabel: "경계", highLabel: "높음" },
  ast: { high: 41, highLabel: "높음" },
  alt: { high: 36, highLabel: "높음" },
  ggt: (sex) => ({ high: sex === "female" ? 36 : 64, highLabel: "높음" }),
  creatinine: { high: 1.6, highLabel: "높음" },
  egfr: { low: 60, lowLabel: "신장기능 저하" },
  hemoglobin: (sex) => ({ low: sex === "female" ? 12 : 13, lowLabel: "빈혈 의심" }),
};

export type ItemAssessment = {
  item: string;
  label: string;
  value: number;
  unit: string;
  severity: Severity;
  statusLabel: string;
  /** 직전 검진 대비 변화 */
  change?: { from: number; date: Date; direction: "better" | "worse" | "same" };
};

/** 수치가 커질수록 나쁜 항목인지 */
const HIGHER_IS_WORSE = (item: string) => !["hdl", "egfr", "hemoglobin"].includes(item);

export function assessItem(item: string, value: number, sex?: Sex, ref?: { low?: number | null; high?: number | null }): Omit<ItemAssessment, "change"> {
  const meta = CHECKUP_ITEMS[item as CheckupItemKey] as { label: string; unit: string } | undefined;
  const tRaw = THRESHOLDS[item as CheckupItemKey];
  const t: Threshold = typeof tRaw === "function" ? tRaw(sex) : (tRaw ?? { low: ref?.low ?? undefined, high: ref?.high ?? undefined });
  let severity: Severity = "normal";
  let statusLabel = "정상";
  if (t.low !== undefined && value < t.low) [severity, statusLabel] = ["low", t.lowLabel ?? "낮음"];
  else if (t.high !== undefined && value >= t.high) [severity, statusLabel] = ["high", t.highLabel ?? "높음"];
  else if (t.caution !== undefined && value >= t.caution) [severity, statusLabel] = ["caution", t.cautionLabel ?? "주의"];
  return { item, label: meta?.label ?? item, value, unit: meta?.unit ?? "", severity, statusLabel };
}

/**
 * 항목마다 가장 최근 값을 판정한다. (재검사처럼 일부 항목만 있는 기록이 추가돼도
 * 다른 항목이 사라지지 않도록, 검진 단위가 아니라 항목 단위로 최신 값을 고른다)
 */
export function assessCheckups(checkups: CheckupRecord[], sex?: Sex): ItemAssessment[] {
  const sorted = [...checkups].sort((a, b) => b.date.getTime() - a.date.getTime());
  const items = [...new Set(sorted.flatMap((c) => c.results.filter((r) => r.value !== null).map((r) => r.item)))];
  const out: ItemAssessment[] = [];
  for (const item of items) {
    const history = sorted.flatMap((c) => {
      const r = c.results.find((x) => x.item === item && x.value !== null);
      return r ? [{ date: c.date, r }] : [];
    });
    const { r } = history[0]!;
    const a: ItemAssessment = assessItem(item, r.value!, sex, { low: r.refLow, high: r.refHigh });
    const prev = history[1];
    const prevValue = prev?.r.value;
    if (prev && prevValue != null) {
      const delta = r.value! - prevValue;
      const rel = Math.abs(delta) / Math.max(Math.abs(prevValue), 1e-9);
      const worse = HIGHER_IS_WORSE(r.item) ? delta > 0 : delta < 0;
      a.change = { from: prevValue, date: prev.date, direction: rel < 0.03 ? "same" : worse ? "worse" : "better" };
    }
    out.push(a);
  }
  return out;
}

/** 코치가 운동·식단 처방에 반영하는 건강 상태 신호 */
export type HealthFlags = {
  betaBlocker: boolean;
  hypoglycemiaRisk: boolean;
  bleedingRisk: boolean;
  hypertension: boolean;
  highLdl: boolean;
  glucoseConcern: boolean;
  reducedKidney: boolean;
  liverConcern: boolean;
  overweight: boolean;
};

export type Lifestyle = {
  /** 최근 4주 주당 평균 유산소 운동 시간(분) */
  weeklyAerobicMin?: number;
  /** 최근 4주 주당 평균 근력 운동 횟수 */
  weeklyStrengthSessions?: number;
  avgSleepHours?: number;
  restingHrTrend?: { now: number; monthAgo: number };
  weightTrendKgPerWeek?: number;
  avgSodiumMg?: number;
};

export type Concern = {
  title: string;
  why: string;
  actions: string[];
  priority: number;
};

export type DoctorReport = {
  latestCheckupDate?: Date;
  items: ItemAssessment[];
  medications: { name: string; drugClass?: DrugClass; classLabel?: string; notes: string[]; monitor: { label: string; status?: string }[] }[];
  concerns: Concern[];
  askAtNextVisit: string[];
  flags: HealthFlags;
  lifestyle: Lifestyle;
};

export function buildDoctorReport(input: {
  checkups: CheckupRecord[];
  medications: MedicationInput[];
  sex?: Sex;
  lifestyle: Lifestyle;
}): DoctorReport {
  const items = assessCheckups(input.checkups, input.sex);
  const by = (k: string) => items.find((i) => i.item === k);
  const bad = (k: string, ...sev: Severity[]) => sev.includes(by(k)?.severity ?? "normal");

  const classes = new Set<DrugClass>();
  const medications = input.medications.map((m) => {
    const cls = classifyMedication(m);
    if (cls) classes.add(cls);
    const info = cls ? DRUG_CLASSES[cls] : undefined;
    return {
      name: m.name,
      drugClass: cls,
      classLabel: info?.label,
      notes: [info?.exercise, info?.nutrition].filter((x): x is string => Boolean(x)),
      monitor: (info?.monitor ?? []).map((k) => {
        const a = by(k);
        return {
          label: (CHECKUP_ITEMS[k as CheckupItemKey] as { label: string } | undefined)?.label ?? k,
          status: a ? `${a.value} ${a.unit} · ${a.statusLabel}` : undefined,
        };
      }),
    };
  });

  const onBpMed = ["betaBlocker", "ccb", "arb", "aceInhibitor", "thiazide"].some((c) => classes.has(c as DrugClass));
  const onDiabetesMed = ["metformin", "sulfonylurea", "insulin", "sglt2"].some((c) => classes.has(c as DrugClass));

  const flags: HealthFlags = {
    betaBlocker: classes.has("betaBlocker"),
    hypoglycemiaRisk: classes.has("sulfonylurea") || classes.has("insulin"),
    bleedingRisk: classes.has("anticoagulant") || classes.has("antiplatelet"),
    hypertension: onBpMed || bad("systolic_bp", "high") || bad("diastolic_bp", "high"),
    highLdl: bad("ldl", "caution", "high") || classes.has("statin"),
    glucoseConcern: onDiabetesMed || bad("fasting_glucose", "caution", "high") || bad("hba1c", "caution", "high"),
    reducedKidney: bad("egfr", "low"),
    liverConcern: bad("alt", "high") || bad("ast", "high") || bad("ggt", "high"),
    overweight: bad("bmi", "caution", "high") || bad("waist", "high"),
  };

  const ls = input.lifestyle;
  const concerns: Concern[] = [];
  const aerobic = ls.weeklyAerobicMin;
  // 권장량(주 150분)에 못 미칠 때만 행동 항목으로 넣는다
  const aerobicNote =
    aerobic !== undefined && aerobic < 150 ? `최근 4주 유산소 운동은 주 평균 ${Math.round(aerobic)}분입니다 (권장 150분 이상).` : "";

  if (flags.glucoseConcern) {
    concerns.push({
      title: onDiabetesMed ? "혈당 관리 (당뇨약 복용 중)" : "혈당이 정상보다 높음",
      why: [by("hba1c"), by("fasting_glucose")].filter(Boolean).map((a) => `${a!.label} ${a!.value}${a!.unit} (${a!.statusLabel})`).join(", ") || "당뇨약 복용 중",
      actions: [
        "식후 10~15분 걷기는 식후 혈당을 낮추는 데 효과적입니다.",
        "근력 운동 주 2회 이상 — 근육이 포도당을 더 많이 사용합니다.",
        flags.overweight ? "체중의 5~7% 감량이 당뇨 진행 위험을 크게 줄입니다." : "정제 탄수화물·단 음료를 줄이세요.",
        aerobicNote,
      ].filter(Boolean),
      priority: bad("hba1c", "high") || bad("fasting_glucose", "high") ? 1 : 2,
    });
  }
  if (flags.hypertension) {
    concerns.push({
      title: onBpMed ? "혈압 관리 (혈압약 복용 중)" : "혈압이 높음",
      why: [by("systolic_bp"), by("diastolic_bp")].filter(Boolean).map((a) => `${a!.label} ${a!.value}${a!.unit}`).join(" / ") || "혈압약 복용 중",
      actions: [
        "나트륨 하루 2,000mg 미만 — 국물·젓갈·가공식품을 줄이세요.",
        "유산소 운동 주 150분 이상이 수축기 혈압을 평균 5~8mmHg 낮춥니다.",
        "근력 운동 중 숨을 참지 말고(발살바 호흡 금지) 들어올릴 때 내쉬세요.",
        "가정 혈압을 아침·저녁으로 재서 진료 때 보여주세요.",
        ls.avgSodiumMg !== undefined ? `최근 식단 기록 기준 나트륨 하루 평균 ${Math.round(ls.avgSodiumMg)}mg.` : "",
      ].filter(Boolean),
      priority: bad("systolic_bp", "high") || bad("diastolic_bp", "high") ? 1 : 2,
    });
  }
  if (flags.highLdl) {
    const onStatin = classes.has("statin");
    concerns.push({
      title: onStatin ? "콜레스테롤 관리 (스타틴 복용 중)" : "LDL 콜레스테롤이 높음",
      why: [by("ldl"), by("triglycerides"), by("hdl")].filter(Boolean).map((a) => `${a!.label} ${a!.value}${a!.unit} (${a!.statusLabel})`).join(", ") || "스타틴 복용 중",
      actions: [
        onStatin && bad("ldl", "caution", "high") ? "약을 먹는데도 LDL 이 높습니다. 복용을 거르지 않았는지 확인하고 진료 때 상의하세요." : "",
        "포화지방(삼겹살·버터·가공육)을 줄이고 생선·견과류·올리브유로 바꾸세요.",
        "유산소 운동은 중성지방을 낮추고 HDL 을 올립니다.",
        aerobicNote,
      ].filter(Boolean),
      priority: bad("ldl", "high") ? 2 : 3,
    });
  }
  if (flags.liverConcern) {
    concerns.push({
      title: "간 수치가 높음",
      why: [by("ast"), by("alt"), by("ggt")].filter((a) => a && a.severity !== "normal").map((a) => `${a!.label} ${a!.value}${a!.unit}`).join(", "),
      actions: [
        flags.overweight ? "과체중과 함께 ALT 가 높으면 지방간 가능성이 있습니다. 체중 감량이 가장 효과적입니다." : "",
        "음주를 줄이세요. 감마지티피(GGT)는 음주에 민감합니다.",
        classes.has("statin") ? "스타틴 복용 중이므로 간 수치 변화를 의사에게 알리세요." : "",
        "고강도 운동 직후에는 AST 가 일시적으로 오를 수 있어, 검사 2~3일 전에는 격한 운동을 피하세요.",
      ].filter(Boolean),
      priority: 2,
    });
  }
  if (flags.reducedKidney) {
    concerns.push({
      title: "신장 기능 저하 소견",
      why: `${by("egfr")!.label} ${by("egfr")!.value}${by("egfr")!.unit}`,
      actions: [
        "고단백 식단을 하지 마세요. 단백질 목표를 체중 1kg당 0.8g 으로 낮췄습니다.",
        "진통소염제(이부프로펜 등)를 자주 먹지 않도록 하세요.",
        "고강도 운동 직후 측정하면 크레아티닌이 오를 수 있어 재검 전엔 격한 운동을 피하세요.",
      ],
      priority: 1,
    });
  }
  if (flags.overweight && !flags.glucoseConcern) {
    const bmi = by("bmi");
    concerns.push({
      title: "체중 관리",
      why: [bmi, by("waist")].filter((a) => a && a.severity !== "normal").map((a) => `${a!.label} ${a!.value}${a!.unit} (${a!.statusLabel})`).join(", "),
      actions: [
        "주 0.25~0.5kg 감량 속도가 근손실 없이 유지하기 좋습니다.",
        "단백질을 충분히(체중 1kg당 1.6g) 먹고 근력 운동을 유지하세요.",
        ls.weightTrendKgPerWeek !== undefined ? `최근 체중 변화: 주 ${ls.weightTrendKgPerWeek >= 0 ? "+" : ""}${ls.weightTrendKgPerWeek.toFixed(2)}kg` : "",
      ].filter(Boolean),
      priority: 3,
    });
  }
  if (by("hemoglobin")?.severity === "low") {
    concerns.push({
      title: "빈혈 의심",
      why: `혈색소 ${by("hemoglobin")!.value}g/dL`,
      actions: ["피로·숨참이 심하면 운동 강도를 낮추고 원인 확인(철분 등)을 위해 진료를 받으세요."],
      priority: 2,
    });
  }
  if (aerobicNote && !concerns.some((c) => c.actions.includes(aerobicNote))) {
    concerns.push({
      title: "유산소 운동량 부족",
      why: aerobicNote,
      actions: ["빠르게 걷기·실내자전거로도 충분합니다. 하루 30분, 주 5일을 목표로 하세요."],
      priority: 4,
    });
  }
  if (ls.avgSleepHours !== undefined && ls.avgSleepHours < 6.5) {
    concerns.push({
      title: "수면 부족",
      why: `최근 평균 수면 ${ls.avgSleepHours.toFixed(1)}시간`,
      actions: ["7시간 이상 자는 것이 혈압·혈당·식욕 조절 모두에 도움이 됩니다."],
      priority: 3,
    });
  }
  if (ls.restingHrTrend && ls.restingHrTrend.now - ls.restingHrTrend.monthAgo >= 5) {
    concerns.push({
      title: "안정시 심박수 상승",
      why: `한 달 전 ${Math.round(ls.restingHrTrend.monthAgo)}bpm → 최근 ${Math.round(ls.restingHrTrend.now)}bpm`,
      actions: ["과훈련·수면 부족·감기 초기일 수 있습니다. 며칠 쉬어도 계속 높으면 진료를 받으세요."],
      priority: 2,
    });
  }

  concerns.sort((a, b) => a.priority - b.priority);

  const askAtNextVisit = [
    ...new Set([
      ...medications.flatMap((m) => (m.drugClass && DRUG_CLASSES[m.drugClass].ask ? [`${m.name}: ${DRUG_CLASSES[m.drugClass].ask}`] : [])),
      ...items.filter((i) => i.change?.direction === "worse" && i.severity !== "normal").map((i) => `${i.label}: 지난 검진보다 나빠짐 (${i.change!.from} → ${i.value}${i.unit})`),
    ]),
  ];

  return {
    latestCheckupDate: input.checkups.map((c) => c.date).sort((a, b) => b.getTime() - a.getTime())[0],
    items,
    medications,
    concerns,
    askAtNextVisit,
    flags,
    lifestyle: ls,
  };
}

export const NO_FLAGS: HealthFlags = {
  betaBlocker: false,
  hypoglycemiaRisk: false,
  bleedingRisk: false,
  hypertension: false,
  highLdl: false,
  glucoseConcern: false,
  reducedKidney: false,
  liverConcern: false,
  overweight: false,
};
