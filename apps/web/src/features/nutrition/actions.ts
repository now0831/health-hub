"use server";

import { db } from "@health/db";
import { refresh } from "next/cache";
import { z } from "zod";

const mealInput = z.object({
  foodId: z.string().min(1),
  amountG: z.coerce.number().positive(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

/** 음식 DB 의 100g 기준 값으로 섭취량만큼 환산해 저장 */
export async function addMeal(formData: FormData) {
  const { foodId, amountG, mealType } = mealInput.parse(Object.fromEntries(formData));
  const food = await db.food.findUniqueOrThrow({ where: { id: foodId } });
  const f = amountG / 100;
  await db.mealEntry.create({
    data: {
      eatenAt: new Date(),
      mealType,
      foodId,
      name: food.name,
      amountG,
      kcal: food.kcal * f,
      proteinG: (food.proteinG ?? 0) * f,
      fatG: (food.fatG ?? 0) * f,
      carbsG: (food.carbsG ?? 0) * f,
      sodiumMg: (food.sodiumMg ?? 0) * f,
    },
  });
  refresh();
}

/** 최근 먹은 기록을 같은 양으로 다시 추가 */
export async function repeatMeal(entryId: string, mealType: string) {
  const e = await db.mealEntry.findUniqueOrThrow({ where: { id: entryId } });
  const { id: _id, eatenAt: _at, ...rest } = e;
  void _id;
  void _at;
  await db.mealEntry.create({ data: { ...rest, mealType, eatenAt: new Date() } });
  refresh();
}

export async function deleteMeal(entryId: string) {
  await db.mealEntry.delete({ where: { id: entryId } });
  refresh();
}
