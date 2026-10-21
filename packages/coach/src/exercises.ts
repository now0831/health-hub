import type { MuscleGroup } from "./types.ts";

export type Equipment = "dumbbell" | "pullUpBar" | "bodyweight";

export type Exercise = {
  name: string;
  equipment: Equipment;
  /** 부위별 자극 비중 (주동근 1) */
  muscles: Partial<Record<MuscleGroup, number>>;
  /** 목표 반복 범위. 맨몸 운동은 max 를 넘기면 다음 단계로 */
  repRange: [number, number];
  /** 시간 기반 운동 (플랭크 등, reps = 초) */
  timed?: boolean;
  cue: string;
};

/** 덤벨·철봉·맨몸으로 할 수 있는 기본 운동 목록 */
export const EXERCISES = {
  goblet_squat: {
    name: "고블릿 스쿼트",
    equipment: "dumbbell",
    muscles: { quads: 1, glutes: 0.7, core: 0.3 },
    repRange: [8, 12],
    cue: "덤벨을 가슴 앞에 세워 들고, 무릎이 발끝 방향을 따라가게",
  },
  db_rdl: {
    name: "덤벨 루마니안 데드리프트",
    equipment: "dumbbell",
    muscles: { hamstrings: 1, glutes: 0.8, back: 0.3 },
    repRange: [8, 12],
    cue: "허리를 편 채 엉덩이를 뒤로 빼며 내리기, 무릎은 살짝만 굽힘",
  },
  db_lunge: {
    name: "덤벨 리버스 런지",
    equipment: "dumbbell",
    muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3 },
    repRange: [8, 12],
    cue: "한쪽씩 뒤로 딛기. 반복 수는 한쪽 기준",
  },
  db_calf_raise: {
    name: "덤벨 카프 레이즈",
    equipment: "dumbbell",
    muscles: { calves: 1 },
    repRange: [12, 20],
    cue: "계단 끝에서 하면 가동범위가 커짐",
  },
  db_floor_press: {
    name: "덤벨 플로어 프레스",
    equipment: "dumbbell",
    muscles: { chest: 1, triceps: 0.5, shoulders: 0.4 },
    repRange: [8, 12],
    cue: "바닥에 누워 팔꿈치가 바닥에 닿을 때까지 내리기 (벤치가 있으면 벤치 프레스)",
  },
  db_row: {
    name: "원암 덤벨 로우",
    equipment: "dumbbell",
    muscles: { back: 1, biceps: 0.5 },
    repRange: [8, 12],
    cue: "한 손·한 무릎을 의자에 대고 팔꿈치를 엉덩이 쪽으로 당기기. 반복 수는 한쪽 기준",
  },
  db_shoulder_press: {
    name: "덤벨 숄더 프레스",
    equipment: "dumbbell",
    muscles: { shoulders: 1, triceps: 0.5 },
    repRange: [8, 12],
    cue: "선 자세에서 복부에 힘을 주고 허리가 꺾이지 않게",
  },
  db_curl: {
    name: "덤벨 컬",
    equipment: "dumbbell",
    muscles: { biceps: 1 },
    repRange: [10, 15],
    cue: "팔꿈치를 몸통에 붙이고 반동 없이",
  },
  db_overhead_extension: {
    name: "덤벨 오버헤드 익스텐션",
    equipment: "dumbbell",
    muscles: { triceps: 1 },
    repRange: [10, 15],
    cue: "덤벨 하나를 두 손으로 잡고 머리 뒤로 내렸다 올리기",
  },
  pull_up: {
    name: "풀업",
    equipment: "pullUpBar",
    muscles: { back: 1, biceps: 0.6 },
    repRange: [3, 10],
    cue: "어깨를 먼저 끌어내린 뒤 턱이 바를 넘을 때까지",
  },
  chin_up: {
    name: "친업",
    equipment: "pullUpBar",
    muscles: { back: 0.8, biceps: 0.9 },
    repRange: [3, 10],
    cue: "손바닥이 나를 향하게 잡기. 풀업보다 쉬움",
  },
  negative_pull_up: {
    name: "네거티브 풀업",
    equipment: "pullUpBar",
    muscles: { back: 1, biceps: 0.6 },
    repRange: [3, 6],
    cue: "점프로 올라가 3~5초 동안 천천히 내려오기. 풀업 3회가 안 될 때",
  },
  hanging_knee_raise: {
    name: "행잉 니 레이즈",
    equipment: "pullUpBar",
    muscles: { core: 1 },
    repRange: [8, 15],
    cue: "몸이 흔들리지 않게 무릎을 가슴 쪽으로",
  },
  push_up: {
    name: "푸시업",
    equipment: "bodyweight",
    muscles: { chest: 1, triceps: 0.5, shoulders: 0.3 },
    repRange: [8, 25],
    cue: "몸을 일직선으로. 어려우면 무릎을 대고",
  },
  plank: {
    name: "플랭크",
    equipment: "bodyweight",
    muscles: { core: 1 },
    repRange: [30, 90],
    timed: true,
    cue: "엉덩이가 처지거나 솟지 않게 (반복 수 = 초)",
  },
} as const satisfies Record<string, Exercise>;

export type ExerciseKey = keyof typeof EXERCISES;

export const isExerciseKey = (k: string): k is ExerciseKey => k in EXERCISES;

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "가슴",
  back: "등",
  shoulders: "어깨",
  biceps: "이두",
  triceps: "삼두",
  core: "코어",
  quads: "앞허벅지",
  hamstrings: "뒷허벅지",
  glutes: "엉덩이",
  calves: "종아리",
};

export const UPPER: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps"];
export const LOWER: MuscleGroup[] = ["quads", "hamstrings", "glutes", "calves"];
