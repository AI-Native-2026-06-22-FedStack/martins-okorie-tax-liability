import type { SqlClient } from "./cycles.js";

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

export async function listPlanCycleQueueForTenant(
  db: SqlClient,
  { tenant_id, limit = 50 }: PlanCycleQueueQuery
): Promise<PlanCycleQueueRow[]> {
  const result = await db.query<PlanCycleQueueRow>(
    `
      WITH tenant_cycles AS (
        SELECT
          id,
          tenant_id,
          client_id,
          planning_period,
          stage,
          owner,
          priority,
          due_date,
          on_hold,
          hold_reason
        FROM tax_plan_cycle
        WHERE tenant_id = $1
      )
      SELECT
        id,
        tenant_id,
        client_id,
        planning_period,
        stage,
        owner,
        priority,
        due_date::text AS due_date,
        on_hold,
        hold_reason,
        due_date < now()::date AS overdue
      FROM tenant_cycles
      ORDER BY tenant_cycles.due_date ASC, id ASC
      LIMIT $2
    `,
    [tenant_id, limit]
  );

  return result.rows;
}
