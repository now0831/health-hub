import { db } from "@health/db";
import { assessItem, type ItemAssessment } from "@health/coach";
import { CHECKUP_ITEMS, type CheckupItemKey } from "@health/shared";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { StatusBadge, type Tone } from "@/components/meter";
import { addCheckup, deleteCheckup } from "@/features/checkups/actions";
import { loadProfile } from "@/features/coach/inputs";
import { formatDate } from "@/lib/format";

const SEVERITY_TONE: Record<ItemAssessment["severity"], Tone> = { normal: "good", caution: "warning", high: "critical", low: "serious" };

const input = "w-full rounded-lg border border-line bg-background px-2 py-1.5 text-sm";

export default function CheckupsPage() {
  return (
    <>
      <PageHeader title="건강검진" description="연도별 결과와 참고 범위를 비교합니다." />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <CheckupList />
        </Suspense>
        <Card title="검진 결과 입력">
          <form action={addCheckup} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                검진일
                <input name="date" type="date" required className={input} />
              </label>
              <label className="text-xs text-muted">
                검진기관
                <input name="institution" className={input} />
              </label>
            </div>
            <p className="text-xs text-muted">결과지에 있는 항목만 채우면 됩니다.</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CHECKUP_ITEMS).map(([key, meta]) => (
                <label key={key} className="text-xs text-muted">
                  {meta.label} <span className="opacity-70">({meta.unit})</span>
                  <input name={`item_${key}`} type="number" step="any" inputMode="decimal" className={input} />
                </label>
              ))}
            </div>
            <button className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">저장</button>
          </form>
        </Card>
      </div>
    </>
  );
}

async function CheckupList() {
  await connection();
  const profile = await loadProfile();
  const checkups = await db.checkup.findMany({
    include: { results: true },
    orderBy: { date: "desc" },
  });

  if (checkups.length === 0) {
    return (
      <Card>
        <Empty>등록된 검진 결과가 없습니다.</Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {checkups.map((c) => (
        <Card key={c.id} title={`${formatDate(c.date)}${c.institution ? ` · ${c.institution}` : ""}`}>
          <form action={deleteCheckup.bind(null, c.id)} className="-mt-2 mb-2 text-right">
            <button className="text-xs text-muted hover:text-critical">삭제</button>
          </form>
          <table className="w-full text-sm">
            <tbody>
              {c.results.map((r) => {
                const label = (CHECKUP_ITEMS[r.item as CheckupItemKey] as { label: string } | undefined)?.label ?? r.item;
                // 주치의 화면과 같은 판정 기준 (@health/coach)
                const a = r.value !== null ? assessItem(r.item, r.value, profile.sex, { low: r.refLow, high: r.refHigh }) : null;
                return (
                  <tr key={r.id} className="border-t border-line first:border-t-0">
                    <td className="py-2">{label}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.value ?? r.textValue} <span className="text-xs text-muted">{r.unit}</span>
                    </td>
                    <td className="py-2 pl-4 text-right">
                      {a && <StatusBadge tone={SEVERITY_TONE[a.severity]}>{a.statusLabel}</StatusBadge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
