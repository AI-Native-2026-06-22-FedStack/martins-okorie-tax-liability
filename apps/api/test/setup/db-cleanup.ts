import pg from "pg";
import { beforeEach } from "vitest";

const { Client } = pg;

beforeEach(async () => {
  const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error("TAXPULSE_TEST_DATABASE_URL is required for API test database cleanup.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("TRUNCATE audit_entry, stage_transition, tax_plan_cycle RESTART IDENTITY CASCADE");
    await client.query(`
      INSERT INTO tenant (id, name)
      VALUES
          ('11111111-1111-4111-8111-111111111111', 'Evergreen Advisory Local'),
          ('22222222-2222-4222-8222-222222222222', 'Harbor Point Wealth Local')
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name;
    `);
  } finally {
    await client.end();
  }
});
