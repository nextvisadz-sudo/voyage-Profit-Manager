import { Router, type IRouter } from "express";
import { db, commissionConfigTable, searchStatsTable } from "@workspace/db";
import { UpdateCommissionBody, GetCommissionResponse, UpdateCommissionResponse, GetCommissionStatsResponse } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth-service";

const router: IRouter = Router();

// In-memory fallback states if database is null
export let mockCommission = { percent: 10, updatedAt: new Date() };
export let mockStats = { totalSearches: 42, totalHotelsServed: 378, lastSearchAt: new Date() };

async function ensureCommissionExists() {
  if (!db) return mockCommission;
  const rows = await db.select().from(commissionConfigTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(commissionConfigTable).values({ percent: 10 }).returning();
    return row;
  }
  return rows[0];
}

async function ensureStatsExist() {
  if (!db) return mockStats;
  const rows = await db.select().from(searchStatsTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(searchStatsTable).values({}).returning();
    return row;
  }
  return rows[0];
}

router.get("/commission", requireAuth, async (req, res): Promise<void> => {
  const config = await ensureCommissionExists();
  res.json(GetCommissionResponse.parse({
    percent: config.percent,
    updatedAt: config.updatedAt.toISOString(),
  }));
});

router.put("/commission", requireRole(["admin"]), async (req, res): Promise<void> => {
  const parsed = UpdateCommissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", message: parsed.error.message });
    return;
  }

  const { percent } = parsed.data;

  let finalPercent = percent;
  let finalUpdatedAt = new Date();

  if (db) {
    await ensureCommissionExists();
    const [updated] = await db.update(commissionConfigTable)
      .set({ percent, updatedAt: new Date() })
      .returning();
    finalPercent = updated.percent;
    finalUpdatedAt = updated.updatedAt;
  } else {
    mockCommission.percent = percent;
    mockCommission.updatedAt = new Date();
    finalPercent = mockCommission.percent;
    finalUpdatedAt = mockCommission.updatedAt;
  }

  req.log.info({ percent }, "Commission updated");

  res.json(UpdateCommissionResponse.parse({
    percent: finalPercent,
    updatedAt: finalUpdatedAt.toISOString(),
  }));
});

router.get("/commission/stats", requireRole(["admin"]), async (req, res): Promise<void> => {
  const [commissionConfig, stats] = await Promise.all([
    ensureCommissionExists(),
    ensureStatsExist(),
  ]);

  res.json(GetCommissionStatsResponse.parse({
    totalSearches: stats.totalSearches ?? 0,
    totalHotelsServed: stats.totalHotelsServed ?? 0,
    currentPercent: commissionConfig.percent,
    lastSearchAt: stats.lastSearchAt ? stats.lastSearchAt.toISOString() : null,
  }));
});

export default router;

