import { db } from "@whimsync/db";
import { chunkerWorker, closeChunkerWorker } from "./consumers/chunkerConsumer";
import { closeEpisodeWorker, episodeWorker } from "./consumers/episodeConsumer";

console.log(
  "Whimsync BullMQ Worker initialized with shared DB client:",
  !!db,
  "| Episode Worker:",
  episodeWorker.name,
  "| Chunker Worker:",
  chunkerWorker.name,
);

async function gracefulShutdown(signal: string) {
  console.log(`\n[Worker] Received ${signal}. Starting graceful shutdown...`);
  try {
    await closeEpisodeWorker();
    await closeChunkerWorker();
    await db.$client.end();
    console.log("[Worker] Graceful shutdown completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[Worker] Error during graceful shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
