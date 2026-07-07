import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDrizzleDb, type TaxPulseDb } from "../src/db/client.js";
import { CreateCycleRequestSchema } from "../src/db/dto.js";
import {
  findCycleByIdForTenant,
  insertCycleForTenant
} from "../src/repository/cycle.repository.js";
import { makeTaxPlanCycle } from "./factories/make-cycle.js";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

let db: TaxPulseDb;
let pool: ReturnType<typeof createDrizzleDb>["pool"];

describeWithDatabase("cycle repository", () => {
  beforeAll(() => {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error("TAXPULSE_TEST_DATABASE_URL is required for cycle repository tests.");
    }

    const connection = createDrizzleDb(connectionString);
    db = connection.db;
    pool = connection.pool;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("inserts a tenant-scoped cycle and reads it back by generated case id", async () => {
    const fixture = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID
    });
    const input = CreateCycleRequestSchema.parse({
      client_id: fixture.client_id,
      due_date: fixture.due_date,
      hold_reason: fixture.hold_reason,
      on_hold: fixture.on_hold,
      owner: fixture.owner,
      planning_period: fixture.planning_period,
      priority: fixture.priority
    });

    const id = await insertCycleForTenant({ tenant_id: TENANT_A_ID }, input, db);
    const cycle = await findCycleByIdForTenant({ tenant_id: TENANT_A_ID }, id, db);
    const crossTenantCycle = await findCycleByIdForTenant({ tenant_id: TENANT_B_ID }, id, db);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(cycle).toMatchObject({
      client_id: input.client_id,
      due_date: input.due_date,
      hold_reason: input.hold_reason,
      id,
      on_hold: input.on_hold,
      owner: input.owner,
      planning_period: input.planning_period,
      priority: input.priority,
      stage: "Intake",
      tenant_id: TENANT_A_ID
    });
    expect(crossTenantCycle).toBeNull();
  });
});
