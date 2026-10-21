import { db } from "@health/db";
import { METRICS } from "@health/shared";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

const BODY_METRICS = ["weight", "body_fat", "lean_body_mass", "body_water_mass", "bone_mass", "bmr"] as const;

export default function BodyPage() {
  return (
    <>
      <PageHeader title="체성분" description="앳플리 TX → 앳플리 앱 → Health Connect" />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <BodyTable />
      </Suspense>
    </>
  );
}

async function BodyTable() {
  await connection();
  const rows = await db.measurement.findMany({
    where: { metric: { in: [...BODY_METRICS] } },
    orderBy: { measuredAt: "desc" },
    take: 200,
  });

  // TODO: 체중·체지방 추이 차트 (src/components/charts)
  return (
    <Card title="최근 측정 기록">
      {rows.length === 0 ? (
        <Empty>아직 데이터가 없습니다. 동기화 앱에서 동기화를 실행하세요.</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-normal">측정 시각</th>
              <th className="py-2 font-normal">항목</th>
              <th className="py-2 text-right font-normal">값</th>
              <th className="py-2 pl-4 font-normal">출처</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2">{formatDateTime(r.measuredAt)}</td>
                <td className="py-2">{METRICS[r.metric as keyof typeof METRICS]?.label ?? r.metric}</td>
                <td className="py-2 text-right tabular-nums">
                  {r.value.toFixed(1)} {r.unit}
                </td>
                <td className="truncate py-2 pl-4 text-xs text-muted">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
