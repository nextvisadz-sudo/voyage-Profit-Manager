import { Router, type IRouter } from "express";
import { db, commissionConfigTable, searchStatsTable } from "@workspace/db";
import { UpdateCommissionBody, GetCommissionResponse, UpdateCommissionResponse, GetCommissionStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

async function ensureCommissionExists() {
  const rows = await db.select().from(commissionConfigTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(commissionConfigTable).values({ percent: 10 }).returning();
    return row;
  }
  return rows[0];
}

async function ensureStatsExist() {
  const rows = await db.select().from(searchStatsTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(searchStatsTable).values({}).returning();
    return row;
  }
  return rows[0];
}

router.get("/commission", async (req, res): Promise<void> => {
  const config = await ensureCommissionExists();
  res.json(GetCommissionResponse.parse({
    percent: config.percent,
    updatedAt: config.updatedAt.toISOString(),
  }));
});

router.put("/commission", async (req, res): Promise<void> => {
  const parsed = UpdateCommissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", message: parsed.error.message });
    return;
  }

  const { percent } = parsed.data;

  await ensureCommissionExists();
  const [updated] = await db.update(commissionConfigTable)
    .set({ percent, updatedAt: new Date() })
    .returning();

  req.log.info({ percent }, "Commission updated");

  res.json(UpdateCommissionResponse.parse({
    percent: updated.percent,
    updatedAt: updated.updatedAt.toISOString(),
  }));
});

router.get("/commission/stats", async (req, res): Promise<void> => {
  const [commission, stats] = await Promise.all([
    ensureCommissionExists(),
    ensureStatsExist(),
  ]);

  res.json(GetCommissionStatsResponse.parse({
    totalSearches: stats.totalSearches ?? 0,
    totalHotelsServed: stats.totalHotelsServed ?? 0,
    currentPercent: commission.percent,
    lastSearchAt: stats.lastSearchAt ? stats.lastSearchAt.toISOString() : null,
  }));
});

export default router;
