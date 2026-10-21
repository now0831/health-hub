import { isExerciseKey, startOfDay } from "@health/coach";
import { db } from "@health/db";
import { z } from "zod";
import { verifySyncToken } from "@/lib/auth";

const setInput = z.object({
  exercise: z.string().refine(isExerciseKey, "알 수 없는 운동"),
  weightKg: z.number().min(0).max(500),
  reps: z.number().int().min(1).max(600),
  performedAt: z.coerce.date().optional(),
});

/** 동기화 앱에서 근력 세트 기록 */
export async function POST(request: Request) {
  if (!verifySyncToken(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = setInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const set = await db.strengthSet.create({
    data: { ...parsed.data, performedAt: parsed.data.performedAt ?? new Date() },
  });
  return Response.json(set, { status: 201 });
}

/** 오늘 기록한 세트 목록 */
export async function GET(request: Request) {
  if (!verifySyncToken(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const sets = await db.strengthSet.findMany({
    where: { performedAt: { gte: startOfDay(new Date()) } },
    orderBy: { performedAt: "asc" },
  });
  return Response.json(sets);
}
