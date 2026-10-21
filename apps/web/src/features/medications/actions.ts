"use server";

import { db } from "@health/db";
import { refresh } from "next/cache";
import { z } from "zod";

const medicationInput = z.object({
  name: z.string().trim().min(1),
  ingredient: z.string().trim().optional(),
  dosage: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  startDate: z.coerce.date(),
  /** "08:00, 20:00" 처럼 쉼표로 구분 */
  times: z.string().trim().optional(),
});

export async function addMedication(formData: FormData) {
  const input = medicationInput.parse(Object.fromEntries(formData));
  const times = (input.times ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t));

  await db.medication.create({
    data: {
      name: input.name,
      ingredient: input.ingredient || null,
      dosage: input.dosage || null,
      instructions: input.instructions || null,
      startDate: input.startDate,
      schedules: { create: times.map((timeOfDay) => ({ timeOfDay, daysOfWeek: [] })) },
    },
  });
  refresh();
}

export async function setMedicationActive(id: string, active: boolean) {
  await db.medication.update({ where: { id }, data: { active } });
  refresh();
}
