import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listPlanCycleQueueForTenant } from "../src/repository/plan-cycle-queue.js";
import {
  makeTaxPlanCycle,
  type TaxPlanCycleFactoryRow,
  type TaxPlanCycleStage
} from "./factories/make-cycle.js";

const { Client } = pg;

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

let db: pg.Client;

function dateFromToday(dayOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);

  return date.toISOString().slice(0, 10);
}

async function insertTaxPlanCycle(row: TaxPlanCycleFactoryRow): Promise<void> {
  await db.query(
    `
      INSERT INTO tax_plan_cycle (
        id,
        tenant_id,
        client_id,
        planning_period,
        stage,
        owner,
        priority,
        due_date,
        on_hold,
        hold_reason,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
    `,
    [
      row.id,
      row.tenant_id,
      row.client_id,
      row.planning_period,
      row.stage,
      row.owner,
      row.priority,
      row.due_date,
      row.on_hold,
      row.hold_reason,
      row.metadata,
      row.created_at,
      row.updated_at
    ]
  );
}

describeWithDatabase("plan cycle queue read", () => {
  beforeAll(async () => {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error("TAXPULSE_TEST_DATABASE_URL is required for plan cycle queue tests.");
    }

    db = new Client({ connectionString });
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
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

    const rows = await listPlanCycleQueueForTenant(db, { tenant_id: TENANT_A_ID });

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
      constraint: "tax_plan_cycle_stage_check"
    });
  });
});
