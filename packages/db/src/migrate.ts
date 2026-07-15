import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, queryClient } from "./client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, "../migrations");

async function runMigrations() {
  console.log("Starting Whimsync database migration runner...");
  try {
    console.log(
      "1. Ensuring pgvector extension exists ('CREATE EXTENSION IF NOT EXISTS vector')...",
    );
    await queryClient`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log("pgvector extension verified/created.");

    console.log(
      `2. Applying Drizzle schema migrations from: ${migrationsFolder}...`,
    );
    await migrate(db, { migrationsFolder });
    console.log("Database migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

runMigrations();
