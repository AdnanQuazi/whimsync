import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing required environment variable: DATABASE_URL. Please ensure your .env file is loaded.",
  );
}

// Singleton connection pool for PostgreSQL
export const queryClient = postgres(connectionString, {
  max: process.env.DB_MAX_CONNECTIONS
    ? Number(process.env.DB_MAX_CONNECTIONS)
    : 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
