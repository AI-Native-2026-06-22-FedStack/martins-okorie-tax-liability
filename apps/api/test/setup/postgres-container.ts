import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

const { Client } = pg;

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = fileURLToPath(new URL("../../", import.meta.url));
const migrationsDir = join(apiRoot, "db", "migrations");
const seedPath = join(apiRoot, "db", "seed.sql");

async function applyMigrations(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const migrationFiles = (await readdir(migrationsDir))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      const migrationSql = await readFile(join(migrationsDir, migrationFile), "utf8");
      await client.query(migrationSql);
    }

    const seedSql = await readFile(seedPath, "utf8");
    await client.query(seedSql);
  } finally {
    await client.end();
  }
}

export default async function setupPostgresContainer(): Promise<() => Promise<void>> {
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
