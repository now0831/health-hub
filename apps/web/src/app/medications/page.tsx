import { db } from "@health/db";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { addMedication, setMedicationActive } from "@/features/medications/actions";
import { formatDate } from "@/lib/format";

const input = "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm";

export default function MedicationsPage() {
  return (
    <>
      <PageHeader title="복약" description="복용 알림은 동기화 앱에서 받을 수 있습니다." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <MedicationList />
        </Suspense>
        <Card title="약 추가">
          <form action={addMedication} className="space-y-3">
            <input name="name" required placeholder="약 이름" className={input} />
            <input name="ingredient" placeholder="성분명 (예: atorvastatin) — 약봉투·처방전에 있음" className={input} />
            <input name="dosage" placeholder="용량 (예: 500mg 1정)" className={input} />
            <input name="instructions" placeholder="복용법 (예: 식후 30분)" className={input} />
            <input name="times" placeholder="복용 시각 (예: 08:00, 20:00)" className={input} />
            <input name="startDate" type="date" required className={input} />
            <button className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              저장
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}

async function MedicationList() {
  await connection();
  const meds = await db.medication.findMany({
    include: { schedules: { orderBy: { timeOfDay: "asc" } } },
    orderBy: [{ active: "desc" }, { startDate: "desc" }],
  });

  // TODO: 오늘 복용 체크리스트 (MedicationLog), 복약 순응도 통계
  return (
    <Card title="약 목록">
      {meds.length === 0 ? (
        <Empty>등록된 약이 없습니다.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {meds.map((m) => (
            <li key={m.id} className={`flex items-start gap-4 py-3 ${m.active ? "" : "opacity-50"}`}>
              <div className="flex-1">
                <div className="font-medium">
                  {m.name} {m.dosage && <span className="text-sm font-normal text-muted">{m.dosage}</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {[
                    m.instructions,
                    m.schedules.map((s) => s.timeOfDay).join(", "),
                    `${formatDate(m.startDate)}부터`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <form action={setMedicationActive.bind(null, m.id, !m.active)}>
                <button className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-line/50">
                  {m.active ? "중단" : "재개"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
