"use client";

import { useEffect, useState } from "react";
import { addMeal } from "./actions";

type Food = {
  id: string;
  name: string;
  category: string | null;
  servingSize: number | null;
  kcal: number;
  proteinG: number | null;
};

const MEAL_TYPES = [
  ["breakfast", "아침"],
  ["lunch", "점심"],
  ["dinner", "저녁"],
  ["snack", "간식"],
] as const;

/** 지금 시각으로 끼니를 추정 */
function guessMeal(): string {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export function FoodSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);

  useEffect(() => {
    if (!q.trim()) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      if (res.ok) setResults(await res.json());
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // 검색어를 지우면 이전 결과를 숨긴다
  const shown = q.trim() ? results : [];
  const serving = picked?.servingSize ?? 100;
  const amountG = Math.round(serving * servings);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPicked(null);
        }}
        placeholder="음식 검색 (예: 김치찌개, 닭가슴살)"
        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm"
      />

      {!picked && shown.length > 0 && (
        <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  setPicked(f);
                  setServings(1);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-accent/10"
              >
                <span>
                  {f.name}
                  {f.category && <span className="ml-2 text-xs text-muted">{f.category}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  1인분 {f.servingSize ?? 100}g · {Math.round((f.kcal * (f.servingSize ?? 100)) / 100)}kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && !picked && shown.length === 0 && <p className="mt-2 text-xs text-muted">검색 결과가 없습니다. 더 짧은 이름으로 찾아보세요.</p>}

      {picked && (
        <form
          action={async (fd) => {
            await addMeal(fd);
            // 기록 후 다음 음식을 바로 찾을 수 있게 초기화
            setPicked(null);
            setQ("");
          }}
          className="mt-3 space-y-3 rounded-lg border border-accent p-3 text-sm"
        >
          <input type="hidden" name="foodId" value={picked.id} />
          <input type="hidden" name="amountG" value={amountG} />
          <div className="font-medium">{picked.name}</div>
          <div className="flex flex-wrap items-center gap-2">
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setServings(s)}
                className={`rounded-full border px-3 py-1 text-xs ${servings === s ? "border-accent bg-accent/10" : "border-line"}`}
              >
                {s}인분
              </button>
            ))}
            <span className="text-xs text-muted">
              = {amountG}g · {Math.round((picked.kcal * amountG) / 100)}kcal · 단백질 {Math.round(((picked.proteinG ?? 0) * amountG) / 100)}g
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select name="mealType" defaultValue={guessMeal()} className="rounded-lg border border-line bg-background px-2 py-1.5">
              {MEAL_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-accent px-4 py-1.5 font-medium text-white hover:opacity-90">기록</button>
            <button type="button" onClick={() => setPicked(null)} className="text-xs text-muted">
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
