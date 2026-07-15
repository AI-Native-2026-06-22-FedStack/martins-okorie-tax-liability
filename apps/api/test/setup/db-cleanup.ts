import pg from "pg";
import { afterEach } from "vitest";

const { Client } = pg;

afterEach(async () => {
  const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error("TAXPULSE_TEST_DATABASE_URL is required for API test database cleanup.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("TRUNCATE stage_transition, tax_plan_cycle RESTART IDENTITY CASCADE");
  } finally {
    await client.end();
  }
});
