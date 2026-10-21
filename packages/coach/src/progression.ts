import { EXERCISES, type Exercise, type ExerciseKey } from "./exercises.ts";
import { startOfDay } from "./load.ts";
import type { StrengthSetLog } from "./types.ts";

export type SetTarget = {
  exercise: ExerciseKey;
  sets: number;
  weightKg: number;
  reps: number;
  /** 왜 이 무게·횟수인지 */
  reason: string;
};

/** Epley 공식으로 1회 최대 중량 추정 */
export const estimate1RM = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);

/** 가장 최근 운동한 날의 해당 운동 세트들 */
function lastSession(exercise: ExerciseKey, history: StrengthSetLog[]) {
  const sets = history.filter((s) => s.exercise === exercise).sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
  if (sets.length === 0) return [];
  const day = startOfDay(sets[0]!.performedAt).getTime();
  return sets.filter((s) => startOfDay(s.performedAt).getTime() === day);
}

/**
 * 점진적 과부하 (Fitbod 방식 참고):
 * - 지난번 모든 세트를 반복 범위 상한까지 해냈다 → 다음 무게로 올리고 반복은 하한부터
 * - 목표 반복은 해냈다 → 같은 무게로 1회 추가
 * - 못 해냈다 → 같은 무게·횟수 유지
 * 덤벨은 보유한 무게 중에서만 고른다.
 */
export function nextTarget(
  exercise: ExerciseKey,
  sets: number,
  history: StrengthSetLog[],
  dumbbellsKg: number[],
): SetTarget {
  const ex: Exercise = EXERCISES[exercise];
  const [lo, hi] = ex.repRange;
  const prev = lastSession(exercise, history);
  const available = [...dumbbellsKg].sort((a, b) => a - b);

  if (prev.length === 0) {
    const start = ex.equipment === "dumbbell" ? (available[0] ?? 0) : 0;
    return {
      exercise,
      sets,
      weightKg: start,
      reps: ex.timed ? lo : Math.round((lo + hi) / 2),
      reason:
        ex.equipment === "dumbbell"
          ? "첫 기록: 가벼운 무게로 자세를 익히세요. 2~3회 더 할 수 있을 때 멈추면 적당합니다."
          : "첫 기록: 할 수 있는 만큼 하고 기록하세요.",
    };
  }

  const weight = Math.max(...prev.map((s) => s.weightKg));
  const working = prev.filter((s) => s.weightKg === weight);
  const minReps = Math.min(...working.map((s) => s.reps));

  if (ex.equipment === "dumbbell" && minReps >= hi) {
    const heavier = available.find((w) => w > weight);
    if (heavier !== undefined) {
      return { exercise, sets, weightKg: heavier, reps: lo, reason: `지난번 ${weight}kg × ${hi}회를 모두 해냈습니다 → 무게 올리기` };
    }
    return { exercise, sets, weightKg: weight, reps: hi + 2, reason: "보유한 덤벨 중 가장 무겁습니다 → 반복 수로 강도 올리기" };
  }

  if (exercise === "negative_pull_up" && minReps >= hi) {
    return { exercise: "pull_up", sets, weightKg: 0, reps: 3, reason: "네거티브를 충분히 해냈습니다 → 풀업 3회 도전" };
  }
  if ((exercise === "pull_up" || exercise === "chin_up") && minReps < 3) {
    return { exercise: "negative_pull_up", sets, weightKg: 0, reps: 4, reason: "풀업 3회가 아직 어렵습니다 → 네거티브로 근력 키우기" };
  }

  if (minReps >= lo) {
    const reps = Math.min(minReps + (ex.timed ? 10 : 1), ex.equipment === "dumbbell" ? hi : hi + 10);
    return { exercise, sets, weightKg: weight, reps, reason: `지난번 ${minReps}${ex.timed ? "초" : "회"} 성공 → ${ex.timed ? "10초" : "1회"} 늘리기` };
  }
  return { exercise, sets, weightKg: weight, reps: Math.max(minReps, 1), reason: `지난번 목표에 못 미쳤습니다 → 같은 무게로 다시` };
}
