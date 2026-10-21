import { db } from "@health/db";

/** 음식 이름 검색 (식약처 음식 DB, 로컬) */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return Response.json([]);

  const foods = await db.food.findMany({
    where: { name: { contains: q } },
    take: 50,
  });
  // 검색어로 시작하는 이름, 짧은 이름을 먼저
  foods.sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)) || a.name.length - b.name.length);

  return Response.json(foods.slice(0, 20));
}
