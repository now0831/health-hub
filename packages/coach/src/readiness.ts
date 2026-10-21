import { DAY, HOUR, acuteChronicRatio, clamp, mean } from "./load.ts";
import type { CheckIn, DailyValue, SleepNight } from "./types.ts";

/**
 * 회복 점수 (0~100). Garmin Training Readiness 의 입력 요소를 따르고,
 * HRV·안정시 심박은 WHOOP/Oura 처럼 "내 평소 값" 대비 변화로 본다.
 * 가중치는 상용 서비스가 공개하지 않아 직접 정했다. 데이터가 없는 요소는 빼고 나머지로 재계산한다.
 */
export const READINESS_WEIGHTS = {
  sleep: 25,
  sleepHistory: 10,
  restingHr: 15,
  hrv: 10,
  load: 20,
  recovery: 10,
  subjective: 10,
} as const;

export type ReadinessFactor = keyof typeof READINESS_WEIGHTS;

export type ReadinessBand = "prime" | "high" | "moderate" | "low" | "poor";

export const BAND_LABELS: Record<ReadinessBand, string> = {
  prime: "최상",
  high: "좋음",
  moderate: "보통",
  low: "낮음",
  poor: "매우 낮음",
};

export type Readiness = {
  score: number;
  band: ReadinessBand;
  /** 각 요소의 점수와 설명. 데이터가 없으면 score 가 null */
  factors: Record<ReadinessFactor, { score: number | null; detail: string }>;
  /** 반영된 요소 가중치 합 / 전체. 낮으면 점수를 덜 믿어야 한다 */
  coverage: number;
};

export type ReadinessInput = {
  now: Date;
  /** 최근 30일 이상의 수면, 시간순 */
  sleeps: SleepNight[];
  /** 밤사이 안정시 심박 (최근 30일 이상) */
  restingHr: DailyValue[];
  hrv: DailyValue[];
  /** 최근 28일 일별 부하 (마지막이 오늘) */
  loads28: number[];
  /** 마지막 고강도·중강도 운동 시각과 부하 */
  lastSession?: { at: Date; load: number };
  checkIn?: CheckIn;
};

export function bandOf(score: number): ReadinessBand {
  // Garmin 매뉴얼의 구간
  if (score >= 95) return "prime";
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  if (score >= 25) return "low";
  return "poor";
}

/** 수면 시간 점수: 7~9시간 100점, 4시간 이하 0점 */
function durationScore(hours: number) {
  if (hours >= 7 && hours <= 9.5) return 100;
  if (hours > 9.5) return clamp(100 - (hours - 9.5) * 20);
  return clamp(((hours - 4) / 3) * 100);
}

function nightScore(n: SleepNight) {
  const hours = (n.end.getTime() - n.start.getTime()) / HOUR;
  const dur = durationScore(hours);
  if (n.deepRemRatio === undefined) return dur;
  // 깊은 잠+REM 이 40% 이상이면 만점
  const quality = clamp((n.deepRemRatio / 0.4) * 100);
  return 0.7 * dur + 0.3 * quality;
}

const hoursOf = (n: SleepNight) => (n.end.getTime() - n.start.getTime()) / HOUR;

/** 최근 기준선(오늘 제외)의 평균과 표준편차 */
function baseline(values: DailyValue[], now: Date, days: number) {
  const from = now.getTime() - days * DAY;
  const prior = values.filter((v) => v.date.getTime() >= from && v.date.getTime() < now.getTime() - 12 * HOUR);
  const xs = prior.map((v) => v.value);
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  return { mean: m, sd, n: xs.length };
}

/** 오늘(최근 18시간 이내) 값 */
function latest(values: DailyValue[], now: Date) {
  const v = values.at(-1);
  return v && now.getTime() - v.date.getTime() < 18 * HOUR ? v.value : undefined;
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const { now } = input;
  const factors = {} as Readiness["factors"];

  // 1) 어젯밤 수면 — 지난 18시간 안에 끝난 수면
  const lastNight = input.sleeps.filter((s) => now.getTime() - s.end.getTime() < 18 * HOUR).at(-1);
  factors.sleep = lastNight
    ? {
        score: nightScore(lastNight),
        detail: `${hoursOf(lastNight).toFixed(1)}시간${
          lastNight.deepRemRatio !== undefined ? `, 깊은 잠+REM ${Math.round(lastNight.deepRemRatio * 100)}%` : ""
        }`,
      }
    : { score: null, detail: "어젯밤 수면 기록 없음" };

  // 2) 최근 3일 수면
  const recent = input.sleeps.filter((s) => now.getTime() - s.end.getTime() < 3 * DAY);
  factors.sleepHistory = recent.length
    ? {
        score: mean(recent.map(nightScore)),
        detail: `최근 ${recent.length}일 평균 ${mean(recent.map(hoursOf)).toFixed(1)}시간`,
      }
    : { score: null, detail: "최근 3일 수면 기록 없음" };

  // 3) 안정시 심박 — 평소보다 높으면 피로·스트레스·감기 신호
  const rhrToday = latest(input.restingHr, now);
  const rhrBase = baseline(input.restingHr, now, 30);
  if (rhrToday !== undefined && rhrBase.n >= 5) {
    const diff = rhrToday - rhrBase.mean;
    factors.restingHr = {
      score: clamp(100 - Math.max(0, diff) * 10),
      detail: `${Math.round(rhrToday)}bpm (평소 ${Math.round(rhrBase.mean)}bpm, ${diff >= 0 ? "+" : ""}${diff.toFixed(1)})`,
    };
  } else {
    factors.restingHr = { score: null, detail: rhrToday === undefined ? "오늘 안정시 심박 없음" : "기준선을 만드는 중 (5일 이상 필요)" };
  }

  // 4) HRV — 평소 대비 표준점수
  const hrvToday = latest(input.hrv, now);
  const hrvBase = baseline(input.hrv, now, 30);
  if (hrvToday !== undefined && hrvBase.n >= 5 && hrvBase.sd > 0) {
    const z = (hrvToday - hrvBase.mean) / hrvBase.sd;
    factors.hrv = {
      score: clamp(75 + z * 20),
      detail: `${Math.round(hrvToday)}ms (평소 ${Math.round(hrvBase.mean)}ms)`,
    };
  } else {
    factors.hrv = { score: null, detail: "HRV 데이터 없음" };
  }

  // 5) 운동 부하 균형 — 운동 기록이 거의 없으면 판단 근거가 없으므로 점수에서 뺀다
  // (100점으로 넣으면 수면·심박 같은 실제 신호가 묻힌다)
  const ratio = acuteChronicRatio(input.loads28);
  factors.load =
    ratio === null
      ? { score: null, detail: "최근 4주 운동량이 적어 부하 부담 없음" }
      : {
          score: ratio <= 1.3 ? 100 : clamp(100 - ((ratio - 1.3) / 0.7) * 100),
          detail: `최근 1주/4주 부하 비율 ${ratio.toFixed(2)} (적정 0.8~1.3)`,
        };

  // 6) 마지막 운동 이후 회복 시간 — 부하 100 이상이면 48시간, 50 이상이면 24시간 필요
  if (input.lastSession && input.lastSession.load >= 50) {
    const need = input.lastSession.load >= 100 ? 48 : 24;
    const since = (now.getTime() - input.lastSession.at.getTime()) / HOUR;
    factors.recovery = {
      score: clamp((since / need) * 100),
      detail: `마지막 운동 후 ${Math.round(since)}시간 (권장 ${need}시간)`,
    };
  } else {
    factors.recovery = { score: null, detail: "최근 고강도 운동 없음" };
  }

  // 7) 주관적 컨디션
  if (input.checkIn) {
    const { energy, stress, soreness } = input.checkIn;
    const s = ((energy - 1) / 4) * 60 + ((5 - stress) / 4) * 40 - soreness.length * 8;
    factors.subjective = {
      score: clamp(s),
      detail: `에너지 ${energy}/5, 스트레스 ${stress}/5${soreness.length ? `, 근육통 ${soreness.length}곳` : ""}`,
    };
  } else {
    factors.subjective = { score: null, detail: "오늘 컨디션 체크 안 함" };
  }

  let total = 0;
  let weight = 0;
  for (const [k, f] of Object.entries(factors) as [ReadinessFactor, { score: number | null }][]) {
    if (f.score === null) continue;
    total += f.score * READINESS_WEIGHTS[k];
    weight += READINESS_WEIGHTS[k];
  }
  const allWeight = Object.values(READINESS_WEIGHTS).reduce((a, b) => a + b, 0);
  const score = weight > 0 ? Math.round(total / weight) : 60;

  return { score, band: bandOf(score), factors, coverage: weight / allWeight };
}

/**
 * 밤사이 안정시 심박: 수면 중 심박 샘플의 5분 이동평균 최솟값.
 * Garmin 이 Health Connect 에 RestingHeartRate 를 쓰지 않아도 심박 샘플로 계산할 수 있다.
 */
export function restingHrFromSamples(samples: { time: Date; bpm: number }[], night: SleepNight): number | undefined {
  const inSleep = samples
    .filter((s) => s.time >= night.start && s.time <= night.end)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  if (inSleep.length < 10) return undefined;
  let best = Infinity;
  for (let i = 0; i < inSleep.length; i++) {
    const windowEnd = inSleep[i]!.time.getTime() + 5 * 60_000;
    const win = [];
    for (let j = i; j < inSleep.length && inSleep[j]!.time.getTime() <= windowEnd; j++) win.push(inSleep[j]!.bpm);
    // 기기마다 샘플 간격이 달라(1~5분) 2개 이상이면 인정
    if (win.length >= 2) best = Math.min(best, mean(win));
  }
  return Number.isFinite(best) ? Math.round(best) : undefined;
}
