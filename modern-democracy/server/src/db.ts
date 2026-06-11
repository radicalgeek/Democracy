import { readFileSync } from "node:fs";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://democracy:democracy@localhost:5433/democracy";

export const sql = postgres(DATABASE_URL, {
  onnotice: () => {},
  max: 10
});

export async function ensureSchema() {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  // api and worker boot concurrently; concurrent CREATE TABLE IF NOT EXISTS
  // can still collide in pg_type, so serialize schema application.
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(41)`;
    await tx.unsafe(schema);
  });
}

export async function waitForDatabase(attempts = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sql`select 1`;
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
