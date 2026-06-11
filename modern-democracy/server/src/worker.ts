import { ensureSchema, waitForDatabase } from "./db.js";
import {
  checkpointAllBills,
  runFullImport,
  seedDemoBallots,
  seedDivisionBallots
} from "./worker-jobs.js";

const IMPORT_INTERVAL_MS = Number(process.env.IMPORT_INTERVAL_MS ?? 6 * 60 * 60 * 1000);
const CHECKPOINT_INTERVAL_MS = Number(process.env.CHECKPOINT_INTERVAL_MS ?? 60 * 1000);
const DEMO_SEED = (process.env.DEMO_SEED ?? "false").toLowerCase() === "true";

async function main() {
  await waitForDatabase();
  await ensureSchema();

  console.log("[worker] starting full import...");
  try {
    const summary = await runFullImport();
    console.log("[worker] import complete:", JSON.stringify(summary));
  } catch (error) {
    console.error("[worker] import failed:", error);
  }

  if (DEMO_SEED) {
    try {
      const seeded = await seedDemoBallots();
      console.log("[worker] demo seed:", JSON.stringify(seeded));
      const divisionSeed = await seedDivisionBallots();
      console.log("[worker] division demo seed:", JSON.stringify(divisionSeed));
    } catch (error) {
      console.error("[worker] demo seed failed:", error);
    }
  }

  setInterval(async () => {
    try {
      const result = await checkpointAllBills();
      if (result.published > 0) console.log("[worker] checkpoints published:", result.published);
    } catch (error) {
      console.error("[worker] checkpoint pass failed:", error);
    }
  }, CHECKPOINT_INTERVAL_MS);

  setInterval(async () => {
    try {
      const summary = await runFullImport();
      console.log("[worker] periodic import complete:", JSON.stringify(summary));
    } catch (error) {
      console.error("[worker] periodic import failed:", error);
    }
  }, IMPORT_INTERVAL_MS);

  console.log("[worker] running. checkpoint interval", CHECKPOINT_INTERVAL_MS, "ms");
}

main().catch((error) => {
  console.error("worker failed to start", error);
  process.exit(1);
});
