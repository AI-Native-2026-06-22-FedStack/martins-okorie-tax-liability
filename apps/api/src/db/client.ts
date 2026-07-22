import { drizzle } from "drizzle-orm/node-postgres";
import type { Logger } from "drizzle-orm/logger";
import pg from "pg";

import { getApiEnv } from "../config/env.js";
import { getRuntimeSecrets } from "../config/secrets.js";
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

function buildRuntimeConnectionString(): string {
  const env = getApiEnv();
  const { databasePassword } = getRuntimeSecrets();
  const url = new URL(`postgresql://${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  url.username = env.DB_USER;
  url.password = databasePassword;

  if (env.DB_SSL === "require") {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}

function getDefaultConnection(): ReturnType<typeof createDrizzleDb> {
  if (!defaultConnection) {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL ?? buildRuntimeConnectionString();

    if (!connectionString) {
      throw new Error(
        "Database configuration is required for database access."
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
