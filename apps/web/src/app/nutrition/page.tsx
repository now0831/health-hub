import { startOfDay } from "@health/coach";
import { db } from "@health/db";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { NutritionSummary } from "@/features/coach/components";
import { getTodayCoaching } from "@/features/coach/today";
import { deleteMeal, repeatMeal } from "@/features/nutrition/actions";
import { FoodSearch } from "@/features/nutrition/FoodSearch";

const MEAL_LABELS: Record<string, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" };

export default function NutritionPage() {
  return (
    <>
      <PageHeader title="식단" description="식약처 식품영양성분 DB(음식)에서 검색해 기록합니다. 외부로 전송되지 않습니다." />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card title="음식 추가">
            <Suspense fallback={<Skeleton className="h-10" />}>
              <FoodDbStatus />
            </Suspense>
            <FoodSearch />
          </Card>
          <Suspense fallback={<Skeleton className="h-64" />}>
            <TodayMeals />
          </Suspense>
        </div>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <Summary />
        </Suspense>
      </div>
    </>
  );
}

async function FoodDbStatus() {
  await connection();
  const count = await db.food.count();
  if (count > 0) return null;
  return (
    <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs">
      음식 DB 가 비어 있습니다. 식약처 K-FIND 에서 받은 음식DB 파일로{" "}
      <code className="font-mono">npm run import-foods -w @health/jobs -- &lt;파일경로&gt;</code> 를 실행하세요.
    </p>
  );
}

async function TodayMeals() {
  await connection();
  const today = startOfDay(new Date());
  const [meals, recent] = await Promise.all([
    db.mealEntry.findMany({ where: { eatenAt: { gte: today } }, orderBy: { eatenAt: "asc" } }),
    db.mealEntry.findMany({
      where: { eatenAt: { lt: today } },
      orderBy: { eatenAt: "desc" },
      distinct: ["name"],
      take: 8,
    }),
  ]);

  return (
    <>
      <Card title="오늘 먹은 것">
        {meals.length === 0 ? (
          <Empty>아직 기록이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-10 text-xs text-muted">{MEAL_LABELS[m.mealType]}</span>
                <span className="flex-1">
                  {m.name} <span className="text-xs text-muted">{Math.round(m.amountG)}g</span>
                </span>
                <span className="tabular-nums text-muted">{Math.round(m.kcal)}kcal</span>
                <form action={deleteMeal.bind(null, m.id)}>
                  <button className="text-xs text-muted hover:text-critical" aria-label={`${m.name} 삭제`}>
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {recent.length > 0 && (
        <Card title="최근 먹은 음식 (한 번에 다시 기록)">
          <div className="flex flex-wrap gap-2">
            {recent.map((m) => (
              <form key={m.id} action={repeatMeal.bind(null, m.id, m.mealType)}>
                <button className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent">
                  + {m.name} {Math.round(m.amountG)}g
                </button>
              </form>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

async function Summary() {
  await connection();
  const t = await getTodayCoaching();
  return <NutritionSummary nutrition={t.nutrition} profileComplete={t.profileComplete} />;
}
