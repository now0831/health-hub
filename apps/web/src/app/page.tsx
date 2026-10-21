import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusBadge } from "@/components/meter";
import { PageHeader, Skeleton, Stat } from "@/components/ui";
import {
  CheckInForm,
  FreshnessCard,
  NutritionSummary,
  PlanCard,
  ReadinessCard,
  WeeklyCard,
} from "@/features/coach/components";
import { getTodayCoaching } from "@/features/coach/today";
import { getDashboardSummary } from "@/features/dashboard/queries";
import { formatDate, formatDuration } from "@/lib/format";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="오늘의 코치" description="수면·심박·운동 기록·컨디션으로 오늘 운동과 식단을 정합니다. 모든 계산은 이 PC 안에서 이뤄집니다." />
      <Suspense
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        <Today />
      </Suspense>
    </>
  );
}

async function Today() {
  await connection();
  const [t, s] = await Promise.all([getTodayCoaching(), getDashboardSummary()]);
  const topConcern = t.doctor.concerns[0];

  return (
    <div className="space-y-4">
      {!t.profileComplete && (
        <Link href="/profile" className="block rounded-xl border border-warning bg-warning/10 px-4 py-3 text-sm">
          <StatusBadge tone="warning">설정 필요</StatusBadge> 내 정보(나이·성별·키·보유 덤벨)를 입력하면 심박 구간, 근력 무게, 식단 목표가 정확해집니다. →
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <ReadinessCard coaching={t.coaching} />
        <PlanCard coaching={t.coaching} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CheckInForm checkIn={t.checkIn} />
        <NutritionSummary nutrition={t.nutrition} profileComplete={t.profileComplete} />
        <div className="space-y-4">
          <WeeklyCard coaching={t.coaching} />
          {topConcern && (
            <Link href="/doctor" className="block rounded-xl border border-line bg-surface p-5 hover:border-accent">
              <div className="text-sm font-medium text-muted">주치의 메모</div>
              <div className="mt-2 font-medium">{topConcern.title}</div>
              <p className="mt-1 text-xs text-muted">{topConcern.why}</p>
              <span className="mt-2 inline-block text-sm text-accent">자세히 →</span>
            </Link>
          )}
        </div>
      </div>

      <FreshnessCard coaching={t.coaching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="체중"
          value={s.weight ? `${s.weight.value.toFixed(1)} kg` : "—"}
          sub={s.weight && `${formatDate(s.weight.measuredAt)}${s.bodyFat ? ` · 체지방 ${s.bodyFat.value.toFixed(1)}%` : ""}`}
        />
        <Stat label="오늘 걸음 수" value={Math.round(s.stepsToday).toLocaleString("ko-KR")} />
        <Stat
          label="최근 수면"
          value={s.sleep ? formatDuration(s.sleep.endedAt.getTime() - s.sleep.startedAt.getTime()) : "—"}
          sub={s.sleep && formatDate(s.sleep.startedAt)}
        />
        <Stat
          label="최근 운동"
          value={s.workout?.distanceM ? `${(s.workout.distanceM / 1000).toFixed(2)} km` : (s.workout?.sport ?? "—")}
          sub={s.workout && `${s.workout.title ?? s.workout.sport} · ${formatDate(s.workout.startedAt)}`}
        />
      </div>
    </div>
  );
}
