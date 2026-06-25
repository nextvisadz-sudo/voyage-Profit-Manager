import { pgTable, serial, varchar, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // "admin" or "agent"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  hotelName: varchar("hotel_name", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  checkin: varchar("checkin", { length: 50 }).notNull(),
  checkout: varchar("checkout", { length: 50 }).notNull(),
  nights: integer("nights").notNull(),
  adults: integer("adults").notNull(),
  children: integer("children").notNull(),
  guests: json("guests").notNull(), // Array of guest name strings
  roomCategory: varchar("room_category", { length: 255 }).notNull(),
  boardType: varchar("board_type", { length: 255 }).notNull(),
  price: integer("price").notNull(), // Original provider base price
  markedUpPrice: integer("marked_up_price").notNull(), // Price with commission markup
  agentId: integer("agent_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, createdAt: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;
