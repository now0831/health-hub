import { db } from "@health/db";

export function recentStrengthSets(days = 28) {
  return db.strengthSet.findMany({
    where: { performedAt: { gte: new Date(Date.now() - days * 24 * 3600_000) } },
    orderBy: { performedAt: "desc" },
  });
}
