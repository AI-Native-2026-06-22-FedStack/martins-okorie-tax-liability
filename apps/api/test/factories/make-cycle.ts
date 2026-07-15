import { faker } from "@faker-js/faker";

import type { NewTaxPlanCycle, TaxPlanCycleStage } from "../../src/db/schema.js";

export const DEFAULT_TEST_TENANT_ID = "11111111-1111-4111-8111-111111111111";

export const TAX_PLAN_CYCLE_STAGES = [
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived"
] as const;

export type { TaxPlanCycleStage };

export type TaxPlanCycleFactoryRow = NewTaxPlanCycle & {
  id: string;
  created_at: Date;
  updated_at: Date;
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function makeTaxPlanCycle(
  overrides: Partial<TaxPlanCycleFactoryRow> = {}
): TaxPlanCycleFactoryRow {
  const now = new Date();
  const planningYear = faker.date.soon({ days: 365 }).getUTCFullYear();
  const planningQuarter = faker.number.int({ min: 1, max: 4 });

  return {
    id: faker.string.uuid(),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    client_id: `client-${faker.string.uuid()}`,
    planning_period: `${planningYear} Q${planningQuarter}`,
    stage: "Intake",
    owner: faker.person.fullName(),
    priority: `P${faker.number.int({ min: 1, max: 4 })}`,
    due_date: dateOnly(faker.date.soon({ days: 45 })),
    on_hold: false,
    hold_reason: null,
    metadata: {},
    created_at: now,
    updated_at: now,
    ...overrides
  };
}
