import { db } from "@health/db";
import type { WorkoutLap } from "@health/ingest";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, PageHeader, Skeleton, Stat } from "@/components/ui";
import { formatClock, formatDateTime, formatDuration, formatPace } from "@/lib/format";

export default function WorkoutPage({ params }: PageProps<"/exercise/[workoutId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <WorkoutDetail params={params} />
    </Suspense>
  );
}

async function WorkoutDetail({ params }: Pick<PageProps<"/exercise/[workoutId]">, "params">) {
  const { workoutId } = await params;
  const w = await db.workout.findUnique({ where: { id: workoutId } });
  if (!w) notFound();

  const laps = (w.laps as WorkoutLap[] | null) ?? [];
  const track = (w.track as [number, number][] | null) ?? [];

  return (
    <>
      <PageHeader title={w.title ?? w.sport} description={formatDateTime(w.startedAt)} />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="거리" value={w.distanceM ? `${(w.distanceM / 1000).toFixed(2)} km` : "—"} />
        <Stat label="시간" value={formatDuration(w.endedAt.getTime() - w.startedAt.getTime())} />
        <Stat label="평균 페이스" value={w.avgPaceSec ? formatPace(w.avgPaceSec) : "—"} />
        <Stat label="평균 심박" value={w.avgHr ? `${w.avgHr} bpm` : "—"} sub={w.maxHr && `최대 ${w.maxHr}`} />
      </div>

      {/* TODO: track 좌표로 지도 그리기 (예: Leaflet + OpenStreetMap) */}
      {track.length > 0 && (
        <Card title="경로">
          <p className="text-sm text-muted">GPS 좌표 {track.length}개 저장됨</p>
        </Card>
      )}

      {laps.length > 0 && (
        <div className="mt-4">
          <Card title="랩">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-normal">#</th>
                  <th className="py-2 font-normal">거리</th>
                  <th className="py-2 font-normal">시간</th>
                  <th className="py-2 font-normal">페이스</th>
                  <th className="py-2 font-normal">심박</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">{lap.distanceM ? `${(lap.distanceM / 1000).toFixed(2)} km` : "—"}</td>
                    <td className="py-2">{formatClock(lap.durationSec)}</td>
                    <td className="py-2">{lap.avgPaceSec ? formatPace(lap.avgPaceSec) : "—"}</td>
                    <td className="py-2">{lap.avgHr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
