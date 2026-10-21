"use server";

import { db } from "@health/db";
import { CHECKUP_ITEMS } from "@health/shared";
import { refresh } from "next/cache";
import { z } from "zod";

const checkupInput = z.object({
  date: z.coerce.date(),
  institution: z.string().trim().optional(),
  memo: z.string().trim().optional(),
});

/** 폼의 item_<키> 입력칸에서 값이 있는 항목만 저장 */
export async function addCheckup(formData: FormData) {
  const input = checkupInput.parse(Object.fromEntries(formData));
  const results = Object.entries(CHECKUP_ITEMS).flatMap(([item, meta]) => {
    const raw = String(formData.get(`item_${item}`) ?? "").trim();
    const value = Number(raw);
    return raw && Number.isFinite(value) ? [{ item, value, unit: meta.unit }] : [];
  });
  await db.checkup.create({
    data: {
      date: input.date,
      institution: input.institution || null,
      memo: input.memo || null,
      results: { create: results },
    },
  });
  refresh();
}

export async function deleteCheckup(id: string) {
  await db.checkup.delete({ where: { id } });
  refresh();
}
