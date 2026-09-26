import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __hrmsDb?: Database; __hrmsClient?: Client };

function createDatabase(): Database {
  const url = process.env.DATABASE_URL ?? "file:./data/hrms.db";
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  globalForDb.__hrmsClient = client;
  return drizzle(client, { schema });
}

// Reuse one connection across hot reloads in development.
export const db: Database = globalForDb.__hrmsDb ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalForDb.__hrmsDb = db;

export { schema };
