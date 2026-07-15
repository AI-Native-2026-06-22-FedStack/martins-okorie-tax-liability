import type { Logger } from "drizzle-orm/logger";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDrizzleDb, type TaxPulseDb } from "../src/db/client.js";
import { stageTransition, taxPlanCycle } from "../src/db/schema.js";
import { listCyclesWithTransitionsForTenant } from "../src/repository/cycle.repository.js";
import { makeTaxPlanCycle } from "./factories/make-cycle.js";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

class CountingLogger implements Logger {
  count = 0;

  logQuery(): void {
    this.count += 1;
  }

  reset(): void {
    this.count = 0;
  }
}

let db: TaxPulseDb;
let pool: ReturnType<typeof createDrizzleDb>["pool"];
let logger: CountingLogger;

describeWithDatabase("cycles with stage transitions repository read", () => {
  beforeAll(() => {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error("TAXPULSE_TEST_DATABASE_URL is required for transition read tests.");
    }

    logger = new CountingLogger();
    const connection = createDrizzleDb(connectionString, { logger });
    db = connection.db;
    pool = connection.pool;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("loads cycles and transitions in one joined query without cross-tenant leakage", async () => {
    const tenantACycleOne = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID,
      due_date: "2026-07-10"
    });
    const tenantACycleTwo = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID,
      due_date: "2026-07-11"
    });
    const tenantACycleThree = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID,
      due_date: "2026-07-12"
    });
    const tenantBCycle = makeTaxPlanCycle({
      tenant_id: TENANT_B_ID,
      due_date: "2026-07-09"
    });

    await db
      .insert(taxPlanCycle)
      .values([tenantACycleOne, tenantACycleTwo, tenantACycleThree, tenantBCycle]);
    await db.insert(stageTransition).values([
      {
        actor: "Fictional Advisor",
        case_id: tenantACycleOne.id,
        from_stage: null,
        tenant_id: TENANT_A_ID,
        to_stage: "Intake"
      },
      {
        actor: "Fictional Reviewer",
        case_id: tenantACycleOne.id,
        from_stage: "Intake",
        tenant_id: TENANT_A_ID,
        to_stage: "Data Aggregation"
      },
      {
        actor: "Fictional Advisor",
        case_id: tenantACycleTwo.id,
        from_stage: null,
        tenant_id: TENANT_A_ID,
        to_stage: "Intake"
      },
      {
        actor: "Fictional Advisor",
        case_id: tenantBCycle.id,
        from_stage: null,
        tenant_id: TENANT_B_ID,
        to_stage: "Intake"
      }
    ]);

    logger.reset();
    const rows = await listCyclesWithTransitionsForTenant({ tenant_id: TENANT_A_ID }, db);

    expect(logger.count).toBe(1);
    expect(rows.map((row) => row.cycle.id)).toEqual([
      tenantACycleOne.id,
      tenantACycleTwo.id,
      tenantACycleThree.id
    ]);
    expect(rows.map((row) => row.transitions.map((transition) => transition.case_id))).toEqual([
      [tenantACycleOne.id, tenantACycleOne.id],
      [tenantACycleTwo.id],
      []
    ]);
    expect(
      rows
        .flatMap((row) => row.transitions)
        .every((transition) => transition.tenant_id === TENANT_A_ID)
    ).toBe(true);
  });
});
