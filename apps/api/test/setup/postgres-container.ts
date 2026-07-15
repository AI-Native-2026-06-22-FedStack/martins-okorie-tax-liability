import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = fileURLToPath(new URL("../../", import.meta.url));
const migrationsFolder = join(apiRoot, "drizzle");
const seedPath = join(apiRoot, "db", "seed.sql");

async function applyMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });

    const seedSql = await readFile(seedPath, "utf8");
    await pool.query(seedSql);
  } finally {
    await pool.end();
  }
}

export default async function setupPostgresContainer(): Promise<() => Promise<void>> {
  if (process.env.TAXPULSE_TEST_DATABASE_URL) {
    return async () => {};
  }

  let container: StartedPostgreSqlContainer | undefined;

  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const connectionString = container.getConnectionUri();

  await applyMigrations(connectionString);
  process.env.TAXPULSE_TEST_DATABASE_URL = connectionString;

  return async () => {
    delete process.env.TAXPULSE_TEST_DATABASE_URL;
    await container?.stop();
  };
}

export const postgresContainerSetupPath = currentDir;
