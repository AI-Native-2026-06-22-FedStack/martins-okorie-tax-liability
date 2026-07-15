export interface SqlQueryResult<Row> {
  rows: Row[];
}

export interface SqlClient {
  query<Row>(sql: string, params: readonly unknown[]): Promise<SqlQueryResult<Row>>;
}

export interface TenantScopedCycleQuery {
  tenant_id: string;
  limit?: number;
}

export interface TaxPlanCycleQueueRow {
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
}

export async function listTaxPlanCyclesForTenant(
  db: SqlClient,
  { tenant_id, limit = 50 }: TenantScopedCycleQuery
): Promise<TaxPlanCycleQueueRow[]> {
  const result = await db.query<TaxPlanCycleQueueRow>(
    `
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
      ORDER BY due_date ASC, id ASC
      LIMIT $2
    `,
    [tenant_id, limit]
  );

  return result.rows;
}
