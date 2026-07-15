import type { TaxPulseDb } from "../db/client.js";
import { listTaxPlanCyclesForTenant } from "./cycles.js";

const db = {} as TaxPulseDb;

await listTaxPlanCyclesForTenant({
  tenant_id: "11111111-1111-4111-8111-111111111111"
}, db);

// @ts-expect-error tenant_id is required for every Tax Plan Cycle read.
await listTaxPlanCyclesForTenant({}, db);
