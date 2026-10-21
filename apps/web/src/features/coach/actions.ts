"use server";

import { startOfDay } from "@health/coach";
import { db } from "@health/db";
import { refresh } from "next/cache";
import { z } from "zod";

const checkInInput = z.object({
  energy: z.coerce.number().int().min(1).max(5),
  stress: z.coerce.number().int().min(1).max(5),
  note: z.string().trim().optional(),
});

export async function saveCheckIn(formData: FormData) {
  const input = checkInInput.parse(Object.fromEntries(formData));
  const soreness = formData.getAll("soreness").map(String);
  const date = startOfDay(new Date());
  const data = { ...input, soreness, note: input.note || null };
  await db.dailyCheckIn.upsert({ where: { date }, create: { date, ...data }, update: data });
  refresh();
}

const optionalNumber = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());

const profileInput = z.object({
  birthYear: optionalNumber,
  sex: z.enum(["male", "female", ""]).optional(),
  heightCm: optionalNumber,
  targetWeightKg: optionalNumber,
  goal: z.enum(["lose", "maintain", "gain"]),
  maxHr: optionalNumber,
  dumbbells: z.string().optional(),
  weeklyRuns: z.coerce.number().int().min(0).max(14),
  weeklyRides: z.coerce.number().int().min(0).max(14),
  weeklyStrength: z.coerce.number().int().min(0).max(14),
  notes: z.string().optional(),
});

export async function saveProfile(formData: FormData) {
  const i = profileInput.parse(Object.fromEntries(formData));
  const dumbbellsKg = (i.dumbbells ?? "")
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const data = {
    birthYear: i.birthYear ?? null,
    sex: i.sex || null,
    heightCm: i.heightCm ?? null,
    targetWeightKg: i.targetWeightKg ?? null,
    goal: i.goal,
    maxHr: i.maxHr ?? null,
    dumbbellsKg,
    hasPullUpBar: formData.get("hasPullUpBar") === "on",
    hasIndoorBike: formData.get("hasIndoorBike") === "on",
    weeklyRuns: i.weeklyRuns,
    weeklyRides: i.weeklyRides,
    weeklyStrength: i.weeklyStrength,
    notes: i.notes || null,
  };
  await db.profile.upsert({ where: { id: "me" }, create: { id: "me", ...data }, update: data });
  refresh();
}
