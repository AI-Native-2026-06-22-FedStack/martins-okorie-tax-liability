import { listTaxPlanCyclesForTenant, type SqlClient } from "./cycles.js";

const db: SqlClient = {
  query() {
    return Promise.resolve({ rows: [] });
  }
};

await listTaxPlanCyclesForTenant(db, {
  tenant_id: "11111111-1111-4111-8111-111111111111"
});

// @ts-expect-error tenant_id is required for every Tax Plan Cycle read.
await listTaxPlanCyclesForTenant(db, {});
