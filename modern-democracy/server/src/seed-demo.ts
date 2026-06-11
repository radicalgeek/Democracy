import { ensureSchema, sql, waitForDatabase } from "./db.js";
import { seedDemoCommunity } from "./services/demo-community.js";

/**
 * One-off CLI for the large-scale demo community seed.
 *
 *   npm run seed:demo            — seed (skips if already seeded)
 *   npm run seed:demo -- --force — seed again on top of an existing cohort
 *
 * Scale knobs: DEMO_COMMUNITY_USERS_PER_SEAT (default 10),
 * DEMO_COMMUNITY_BILLS (default 5), DEMO_COMMUNITY_RNG_SEED.
 */
async function main() {
  await waitForDatabase();
  await ensureSchema();
  const force = process.argv.includes("--force");
  const result = await seedDemoCommunity(sql, { force });
  console.log(JSON.stringify(result, null, 2));
  await sql.end();
}

main().catch((error) => {
  console.error("demo community seed failed", error);
  process.exit(1);
});
