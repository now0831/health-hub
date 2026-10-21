import type { ItemAssessment } from "@health/coach";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusBadge, type Tone } from "@/components/meter";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { loadAll } from "@/features/coach/inputs";
import { formatDate } from "@/lib/format";

export default function DoctorPage() {
  return (
    <>
      <PageHeader
        title="주치의"
        description="건강검진 결과·복용 약·기기 데이터를 규칙으로 종합합니다. 진단이 아니라 다음 진료 때 확인할 것을 정리하는 용도입니다."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Report />
      </Suspense>
    </>
  );
}

const SEVERITY_TONE: Record<ItemAssessment["severity"], Tone> = { normal: "good", caution: "warning", high: "critical", low: "serious" };

async function Report() {
  await connection();
  const { doctor: r } = await loadAll();
  const abnormal = r.items.filter((i) => i.severity !== "normal");
  const normal = r.items.filter((i) => i.severity === "normal");

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
        이 내용은 일반적인 건강 정보이며 의사의 진료를 대신하지 않습니다. 약을 끊거나 용량을 바꾸지 말고, 가슴 통증·호흡곤란·한쪽 마비 같은 증상이 있으면
        즉시 119 또는 응급실로 가세요.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="우선 관리할 것">
          {r.concerns.length === 0 ? (
            <Empty>
              {r.items.length === 0 ? (
                <>
                  검진 결과가 없습니다. <Link href="/checkups" className="text-accent">건강검진</Link> 메뉴에서 입력하세요.
                </>
              ) : (
                "특별히 관리가 필요한 항목이 없습니다."
              )}
            </Empty>
          ) : (
            <ol className="space-y-5">
              {r.concerns.map((c, i) => (
                <li key={c.title}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted">{i + 1}.</span>
                    <h3 className="font-semibold">{c.title}</h3>
                  </div>
                  {c.why && <p className="mt-0.5 text-sm text-muted">{c.why}</p>}
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {c.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="다음 진료 때 물어볼 것">
            {r.askAtNextVisit.length === 0 ? (
              <Empty>없음</Empty>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {r.askAtNextVisit.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="생활습관 지표 (최근 기록)">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">유산소 운동</dt>
              <dd className="text-right tabular-nums">{r.lifestyle.weeklyAerobicMin !== undefined ? `주 ${Math.round(r.lifestyle.weeklyAerobicMin)}분` : "—"}</dd>
              <dt className="text-muted">평균 수면</dt>
              <dd className="text-right tabular-nums">{r.lifestyle.avgSleepHours !== undefined ? `${r.lifestyle.avgSleepHours.toFixed(1)}시간` : "—"}</dd>
              <dt className="text-muted">안정시 심박</dt>
              <dd className="text-right tabular-nums">
                {r.lifestyle.restingHrTrend ? `${Math.round(r.lifestyle.restingHrTrend.monthAgo)} → ${Math.round(r.lifestyle.restingHrTrend.now)}bpm` : "—"}
              </dd>
              <dt className="text-muted">체중 변화</dt>
              <dd className="text-right tabular-nums">
                {r.lifestyle.weightTrendKgPerWeek !== undefined ? `주 ${r.lifestyle.weightTrendKgPerWeek >= 0 ? "+" : ""}${r.lifestyle.weightTrendKgPerWeek.toFixed(2)}kg` : "—"}
              </dd>
              <dt className="text-muted">나트륨</dt>
              <dd className="text-right tabular-nums">{r.lifestyle.avgSodiumMg !== undefined ? `하루 ${Math.round(r.lifestyle.avgSodiumMg).toLocaleString("ko-KR")}mg` : "—"}</dd>
            </dl>
          </Card>
        </div>
      </div>

      <Card title={`검진 결과 — 항목별 최근 값${r.latestCheckupDate ? ` (마지막 검진 ${formatDate(r.latestCheckupDate)})` : ""}`}>
        {r.items.length === 0 ? (
          <Empty>검진 결과가 없습니다.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 font-normal">항목</th>
                <th className="py-2 text-right font-normal">결과</th>
                <th className="py-2 pl-4 font-normal">판정</th>
                <th className="py-2 pl-4 font-normal">지난 검진 대비</th>
              </tr>
            </thead>
            <tbody>
              {[...abnormal, ...normal].map((i) => (
                <tr key={i.item} className="border-t border-line">
                  <td className="py-2">{i.label}</td>
                  <td className="py-2 text-right tabular-nums">
                    {i.value} <span className="text-xs text-muted">{i.unit}</span>
                  </td>
                  <td className="py-2 pl-4">
                    <StatusBadge tone={SEVERITY_TONE[i.severity]}>{i.statusLabel}</StatusBadge>
                  </td>
                  <td className="py-2 pl-4 text-xs text-muted">
                    {i.change
                      ? `${i.change.from} → ${i.value} ${i.change.direction === "worse" ? "▲ 나빠짐" : i.change.direction === "better" ? "▼ 좋아짐" : "비슷함"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="복용 중인 약">
        {r.medications.length === 0 ? (
          <Empty>
            등록된 약이 없습니다. <Link href="/medications" className="text-accent">복약</Link> 메뉴에서 추가하세요.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {r.medications.map((m) => (
              <li key={m.name} className="py-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-muted">{m.classLabel ?? "주의사항 규칙이 없는 약·영양제 (만성질환 약이면 복약 메뉴에 성분명을 입력하세요)"}</span>
                </div>
                {m.notes.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {m.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                {m.monitor.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    함께 볼 검사: {m.monitor.map((x) => `${x.label}${x.status ? ` (${x.status})` : ""}`).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">약 사이의 상호작용은 이 화면에서 판단하지 않습니다. 새 약을 추가할 때는 약사에게 확인하세요.</p>
      </Card>
    </div>
  );
}
