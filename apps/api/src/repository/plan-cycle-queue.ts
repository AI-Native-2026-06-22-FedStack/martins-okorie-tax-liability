import { asc, eq, lt } from "drizzle-orm";

import { getDb, type TaxPulseDb } from "../db/client.js";
import { taxPlanCycle } from "../db/schema.js";

export interface PlanCycleQueueQuery {
  tenant_id: string;
  limit?: number;
}

export interface PlanCycleQueueRow {
  id: string;
  tenant_id: string;
  client_id: string;
  planning_period: string;
  stage: string;
  owner: string;
  priority: string;
  due_date: string;
  on_hold: boolean;
  hold_reason: string | null;
  overdue: boolean;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function listPlanCycleQueueForTenant(
  { tenant_id, limit = 50 }: PlanCycleQueueQuery,
  db: TaxPulseDb = getDb()
): Promise<PlanCycleQueueRow[]> {
  const today = dateOnly(new Date());

  return db
    .select({
      client_id: taxPlanCycle.client_id,
      due_date: taxPlanCycle.due_date,
      hold_reason: taxPlanCycle.hold_reason,
      id: taxPlanCycle.id,
      on_hold: taxPlanCycle.on_hold,
      overdue: lt(taxPlanCycle.due_date, today).mapWith(Boolean),
      owner: taxPlanCycle.owner,
      planning_period: taxPlanCycle.planning_period,
      priority: taxPlanCycle.priority,
      stage: taxPlanCycle.stage,
      tenant_id: taxPlanCycle.tenant_id
    })
    .from(taxPlanCycle)
    .where(eq(taxPlanCycle.tenant_id, tenant_id))
    .orderBy(asc(taxPlanCycle.due_date), asc(taxPlanCycle.id))
    .limit(limit);
}
