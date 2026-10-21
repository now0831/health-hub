import { connection } from "next/server";
import { Suspense } from "react";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { saveProfile } from "@/features/coach/actions";
import { loadProfile } from "@/features/coach/inputs";

const input = "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm";
const labelCls = "block text-sm font-medium";

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="내 정보" description="코치가 심박 구간·근력 무게·식단 목표를 계산할 때 씁니다." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProfileForm />
      </Suspense>
    </>
  );
}

async function ProfileForm() {
  await connection();
  const { raw: p } = await loadProfile();
  return (
    <form action={saveProfile} className="grid gap-4 lg:grid-cols-2">
      <Card title="기본 정보">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            출생연도
            <input name="birthYear" type="number" min={1920} max={2020} defaultValue={p?.birthYear ?? ""} className={input} />
          </label>
          <label className={labelCls}>
            성별
            <select name="sex" defaultValue={p?.sex ?? ""} className={input}>
              <option value="">선택</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </label>
          <label className={labelCls}>
            키 (cm)
            <input name="heightCm" type="number" step="0.1" defaultValue={p?.heightCm ?? ""} className={input} />
          </label>
          <label className={labelCls}>
            최대 심박 (선택)
            <input name="maxHr" type="number" placeholder="모르면 비워두세요" defaultValue={p?.maxHr ?? ""} className={input} />
          </label>
        </div>
      </Card>

      <Card title="목표">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            체중 목표
            <select name="goal" defaultValue={p?.goal ?? "maintain"} className={input}>
              <option value="lose">감량</option>
              <option value="maintain">유지</option>
              <option value="gain">증량(근육)</option>
            </select>
          </label>
          <label className={labelCls}>
            목표 체중 (kg)
            <input name="targetWeightKg" type="number" step="0.1" defaultValue={p?.targetWeightKg ?? ""} className={input} />
          </label>
          <label className={labelCls}>
            주간 러닝 횟수
            <input name="weeklyRuns" type="number" min={0} max={14} defaultValue={p?.weeklyRuns ?? 3} className={input} />
          </label>
          <label className={labelCls}>
            주간 실내자전거 횟수
            <input name="weeklyRides" type="number" min={0} max={14} defaultValue={p?.weeklyRides ?? 1} className={input} />
          </label>
          <label className={labelCls}>
            주간 근력 횟수
            <input name="weeklyStrength" type="number" min={0} max={14} defaultValue={p?.weeklyStrength ?? 2} className={input} />
          </label>
        </div>
      </Card>

      <Card title="운동 장비">
        <label className={labelCls}>
          보유 덤벨 무게 (kg, 쉼표로 구분)
          <input name="dumbbells" placeholder="예: 5, 7.5, 10, 12.5" defaultValue={p?.dumbbellsKg.join(", ") ?? ""} className={input} />
        </label>
        <p className="mt-1 text-xs text-muted">무게 조절식 덤벨이면 조절 가능한 무게를 모두 적으세요. 코치가 이 중에서 다음 무게를 고릅니다.</p>
        <div className="mt-3 flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="hasPullUpBar" defaultChecked={p?.hasPullUpBar} /> 철봉
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="hasIndoorBike" defaultChecked={p?.hasIndoorBike} /> 실내자전거
          </label>
        </div>
      </Card>

      <Card title="메모">
        <textarea name="notes" rows={4} placeholder="부상·통증 이력 등" defaultValue={p?.notes ?? ""} className={input} />
        <button className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">저장</button>
      </Card>
    </form>
  );
}
