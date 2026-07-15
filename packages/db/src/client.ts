import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://whimsync:whimsync_dev_pass@localhost:5432/whimsync";

// Singleton connection pool for PostgreSQL
export const queryClient = postgres(connectionString, {
  max: process.env.DB_MAX_CONNECTIONS
    ? Number(process.env.DB_MAX_CONNECTIONS)
    : 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
