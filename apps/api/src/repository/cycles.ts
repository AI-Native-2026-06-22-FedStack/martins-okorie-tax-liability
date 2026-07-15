import { asc, eq } from "drizzle-orm";

import { getDb, type TaxPulseDb } from "../db/client.js";
import { taxPlanCycle, type TaxPlanCycle } from "../db/schema.js";

export interface TenantScopedCycleQuery {
  tenant_id: string;
  limit?: number;
}

export async function listTaxPlanCyclesForTenant(
  { tenant_id, limit = 50 }: TenantScopedCycleQuery,
  db: TaxPulseDb = getDb()
): Promise<TaxPlanCycle[]> {
  return db
    .select()
    .from(taxPlanCycle)
    .where(eq(taxPlanCycle.tenant_id, tenant_id))
    .orderBy(asc(taxPlanCycle.due_date), asc(taxPlanCycle.id))
    .limit(limit);
}
