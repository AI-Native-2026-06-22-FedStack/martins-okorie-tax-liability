import { drizzle } from "drizzle-orm/node-postgres";
import type { Logger } from "drizzle-orm/logger";
import pg from "pg";

import * as schema from "./schema.js";

const { Pool } = pg;

export const TAXPULSE_DB_POOL_MAX = 5;

export interface CreateDrizzleDbOptions {
  logger?: Logger;
  poolMax?: number;
}

export function createDrizzleDb(
  connectionString: string,
  { logger, poolMax = TAXPULSE_DB_POOL_MAX }: CreateDrizzleDbOptions = {}
) {
  const pool = new Pool({
    connectionString,
    max: poolMax
  });

  return {
    db: drizzle(pool, { logger, schema }),
    pool
  };
}

export type TaxPulseDb = ReturnType<typeof createDrizzleDb>["db"];

let defaultConnection: ReturnType<typeof createDrizzleDb> | undefined;

function getDefaultConnection(): ReturnType<typeof createDrizzleDb> {
  if (!defaultConnection) {
    const connectionString = process.env.DATABASE_URI ?? process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        "DATABASE_URI or TAXPULSE_TEST_DATABASE_URL is required for database access."
      );
    }

    defaultConnection = createDrizzleDb(connectionString);
  }

  return defaultConnection;
}

export function getDb(): TaxPulseDb {
  return getDefaultConnection().db;
}

export async function checkDatabaseReady(connection = getDefaultConnection()): Promise<void> {
  await connection.pool.query("SELECT 1");
  // Future cache-aside dependency readiness check belongs here when cache is in scope.
}

export async function closeDefaultDb(): Promise<void> {
  await defaultConnection?.pool.end();
  defaultConnection = undefined;
}
