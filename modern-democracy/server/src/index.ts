import cors from "@fastify/cors";
import Fastify from "fastify";
import { ensureSchema, waitForDatabase } from "./db.js";
import { registerRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 8787);

async function main() {
  await waitForDatabase();
  await ensureSchema();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerRoutes(app);
  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error("api failed to start", error);
  process.exit(1);
});
