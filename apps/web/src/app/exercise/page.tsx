import { EXERCISES, isExerciseKey, startOfDay } from "@health/coach";
import { db } from "@health/db";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { FitUpload } from "@/features/exercise/FitUpload";
import { recentStrengthSets } from "@/features/exercise/queries";
import { formatDate, formatDateTime, formatDuration, formatPace } from "@/lib/format";

export default function ExercisePage() {
  return (
    <>
      <PageHeader title="운동" description="Health Connect 로 요약을, FIT 파일로 경로·랩 상세를 가져옵니다." />
      <div className="space-y-4">
        <Card title="FIT 파일 가져오기">
          <FitUpload />
        </Card>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <WorkoutList />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <StrengthHistory />
        </Suspense>
      </div>
    </>
  );
}

async function WorkoutList() {
  await connection();
  const workouts = await db.workout.findMany({ orderBy: { startedAt: "desc" }, take: 50 });

  return (
    <Card title="최근 운동">
      {workouts.length === 0 ? (
        <Empty>아직 운동 기록이 없습니다.</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link href={`/exercise/${w.id}`} className="flex items-center gap-4 py-3 hover:text-accent">
                <span className="w-40 shrink-0">{formatDateTime(w.startedAt)}</span>
                <span className="flex-1">{w.title ?? w.sport}</span>
                <span className="tabular-nums text-muted">
                  {w.distanceM ? `${(w.distanceM / 1000).toFixed(2)} km · ` : ""}
                  {formatDuration(w.endedAt.getTime() - w.startedAt.getTime())}
                  {w.avgPaceSec ? ` · ${formatPace(w.avgPaceSec)}/km` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function StrengthHistory() {
  await connection();
  const sets = await recentStrengthSets();
  // 날짜 → 운동 → 세트
  const days = new Map<number, Map<string, typeof sets>>();
  for (const s of sets) {
    const d = startOfDay(s.performedAt).getTime();
    const byEx = days.get(d) ?? new Map();
    byEx.set(s.exercise, [...(byEx.get(s.exercise) ?? []), s]);
    days.set(d, byEx);
  }

  return (
    <Card title="근력 운동 기록 (최근 4주)">
      {days.size === 0 ? (
        <Empty>동기화 앱의 &ldquo;오늘&rdquo; 탭에서 세트를 기록하면 여기에 표시됩니다.</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {[...days.entries()].map(([d, byEx]) => (
            <li key={d} className="py-3">
              <div className="mb-1 font-medium">{formatDate(new Date(d))}</div>
              {[...byEx.entries()].map(([ex, list]) => (
                <div key={ex} className="flex gap-3 text-muted">
                  <span className="w-44 shrink-0">{isExerciseKey(ex) ? EXERCISES[ex].name : ex}</span>
                  <span className="tabular-nums">
                    {[...list].reverse().map((s) => (s.weightKg > 0 ? `${s.weightKg}kg×${s.reps}` : `${s.reps}`)).join(" · ")}
                  </span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
