import { pgTable, serial, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionConfigTable = pgTable("commission_config", {
  id: serial("id").primaryKey(),
  percent: real("percent").notNull().default(10),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const searchStatsTable = pgTable("search_stats", {
  id: serial("id").primaryKey(),
  totalSearches: integer("total_searches").notNull().default(0),
  totalHotelsServed: integer("total_hotels_served").notNull().default(0),
  lastSearchAt: timestamp("last_search_at"),
});

export const insertCommissionConfigSchema = createInsertSchema(commissionConfigTable).omit({ id: true });
export type InsertCommissionConfig = z.infer<typeof insertCommissionConfigSchema>;
export type CommissionConfig = typeof commissionConfigTable.$inferSelect;
export type SearchStats = typeof searchStatsTable.$inferSelect;
