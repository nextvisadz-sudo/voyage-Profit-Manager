import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export let pool: any = null;
export let db: any = null;

/**
 * Auto-migration: creates all tables if they don't exist yet.
 * Safe to run on every startup — CREATE TABLE IF NOT EXISTS is idempotent.
 * This removes the need for a separate migration step on fresh databases (e.g. Render).
 */
async function runMigrations(client: InstanceType<typeof Pool>): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS "users" (
      "id"         SERIAL PRIMARY KEY,
      "username"   VARCHAR(50)  NOT NULL UNIQUE,
      "password"   VARCHAR(255) NOT NULL,
      "role"       VARCHAR(20)  NOT NULL,
      "created_at" TIMESTAMP    NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "vouchers" (
      "id"              SERIAL PRIMARY KEY,
      "reference"       VARCHAR(50)  NOT NULL UNIQUE,
      "hotel_name"      VARCHAR(255) NOT NULL,
      "destination"     VARCHAR(255) NOT NULL,
      "checkin"         VARCHAR(50)  NOT NULL,
      "checkout"        VARCHAR(50)  NOT NULL,
      "nights"          INTEGER      NOT NULL,
      "adults"          INTEGER      NOT NULL,
      "children"        INTEGER      NOT NULL,
      "guests"          JSON         NOT NULL,
      "room_category"   VARCHAR(255) NOT NULL,
      "board_type"      VARCHAR(255) NOT NULL,
      "price"           INTEGER      NOT NULL,
      "marked_up_price" INTEGER      NOT NULL,
      "agent_id"        INTEGER      REFERENCES "users"("id"),
      "created_at"      TIMESTAMP    NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "commission_config" (
      "id"         SERIAL    PRIMARY KEY,
      "percent"    REAL      NOT NULL DEFAULT 10,
      "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "search_stats" (
      "id"                  SERIAL    PRIMARY KEY,
      "total_searches"      INTEGER   NOT NULL DEFAULT 0,
      "total_hotels_served" INTEGER   NOT NULL DEFAULT 0,
      "last_search_at"      TIMESTAMP
    );
  `;

  try {
    await client.query(ddl);
    console.log("✅ Database tables verified / created successfully.");
  } catch (err) {
    console.error("❌ Failed to run database migrations:", err);
    // Don't crash the server — fall back to mock data gracefully
  }
}

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });

  // Run auto-migration immediately (non-blocking — server starts even if it fails)
  runMigrations(pool).catch((err) =>
    console.error("Migration error (non-fatal):", err)
  );
} else {
  console.warn("⚠️ DATABASE_URL is not set. Database operations will use in-memory mock fallback.");
}

export * from "./schema";

