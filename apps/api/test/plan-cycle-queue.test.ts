import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDrizzleDb, type TaxPulseDb } from "../src/db/client.js";
import { taxPlanCycle } from "../src/db/schema.js";
import { listPlanCycleQueueForTenant } from "../src/repository/plan-cycle-queue.js";
import {
  makeTaxPlanCycle,
  type TaxPlanCycleFactoryRow,
  type TaxPlanCycleStage
} from "./factories/make-cycle.js";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

let db: TaxPulseDb;
let pool: ReturnType<typeof createDrizzleDb>["pool"];

function dateFromToday(dayOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);

  return date.toISOString().slice(0, 10);
}

async function insertTaxPlanCycle(row: TaxPlanCycleFactoryRow): Promise<void> {
  await db.insert(taxPlanCycle).values(row);
}

describeWithDatabase("plan cycle queue read", () => {
  beforeAll(async () => {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error("TAXPULSE_TEST_DATABASE_URL is required for plan cycle queue tests.");
    }

    const connection = createDrizzleDb(connectionString);
    db = connection.db;
    pool = connection.pool;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns tenant cycles ordered by due date with a derived overdue flag and no cross-tenant leakage", async () => {
    const tenantAPastLater = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID,
      due_date: dateFromToday(-1),
      planning_period: "2026 Q2"
    });
    const tenantAFuture = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID,
      due_date: dateFromToday(10),
      planning_period: "2026 Q3"
    });
    const tenantAPastEarlier = makeTaxPlanCycle({
      tenant_id: TENANT_A_ID,
      due_date: dateFromToday(-7),
      planning_period: "2026 Q1"
    });
    const tenantBEarlier = makeTaxPlanCycle({
      tenant_id: TENANT_B_ID,
      due_date: dateFromToday(-30),
      planning_period: "2026 Q1"
    });

    await insertTaxPlanCycle(tenantAFuture);
    await insertTaxPlanCycle(tenantBEarlier);
    await insertTaxPlanCycle(tenantAPastLater);
    await insertTaxPlanCycle(tenantAPastEarlier);

    const rows = await listPlanCycleQueueForTenant({ tenant_id: TENANT_A_ID }, db);

    expect(rows.map((row) => row.id)).toEqual([
      tenantAPastEarlier.id,
      tenantAPastLater.id,
      tenantAFuture.id
    ]);
    expect(rows.map((row) => row.due_date)).toEqual([
      tenantAPastEarlier.due_date,
      tenantAPastLater.due_date,
      tenantAFuture.due_date
    ]);
    expect(rows.map((row) => [row.id, row.overdue])).toEqual([
      [tenantAPastEarlier.id, true],
      [tenantAPastLater.id, true],
      [tenantAFuture.id, false]
    ]);
    expect(rows.every((row) => row.tenant_id === TENANT_A_ID)).toBe(true);
    expect(rows.map((row) => row.id)).not.toContain(tenantBEarlier.id);
  });

  it("rejects an out-of-set stage through the real database constraint", async () => {
    const invalidCycle = makeTaxPlanCycle({
      stage: "Ready for Filing" as TaxPlanCycleStage
    });

    await expect(insertTaxPlanCycle(invalidCycle)).rejects.toMatchObject({
      cause: {
        constraint: "tax_plan_cycle_stage_check"
      }
    });
  });
});
