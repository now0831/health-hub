import { db } from "@health/db";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { formatDateTime, formatDuration } from "@/lib/format";

export default function SleepPage() {
  return (
    <>
      <PageHeader title="수면" description="가민 포러너 165 → Garmin Connect → Health Connect" />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SleepList />
      </Suspense>
    </>
  );
}

async function SleepList() {
  await connection();
  const sessions = await db.sleepSession.findMany({ orderBy: { startedAt: "desc" }, take: 30 });

  // TODO: 수면 단계(깊은/얕은/REM) 타임라인 차트
  return (
    <Card title="최근 30회">
      {sessions.length === 0 ? (
        <Empty>아직 수면 기록이 없습니다.</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>{formatDateTime(s.startedAt)}</span>
              <span className="tabular-nums">{formatDuration(s.endedAt.getTime() - s.startedAt.getTime())}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
