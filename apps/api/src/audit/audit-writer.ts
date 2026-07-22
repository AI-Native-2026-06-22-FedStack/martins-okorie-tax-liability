import { getDb } from "../db/client.js";
import { auditEntry } from "../db/schema.js";
import { AuditEntrySchema, type ValidatedAuditEntry } from "./audit-entry.schema.js";

type TaxPulseDb = ReturnType<typeof getDb>;
type TaxPulseTransaction = Parameters<Parameters<TaxPulseDb["transaction"]>[0]>[0];
type DbExecutor = TaxPulseDb | TaxPulseTransaction;

/**
 * Inserts a validated audit entry into the database.
 * Validates the five-field schema at write time, rejecting any incomplete logs.
 * Supports executing within an active Drizzle transaction.
 */
export async function writeAuditEntry(
  input: {
    tenant_id: string;
    case_id: string | null;
    actor: string;
    action: string;
    reason: string;
    result: "success" | "failure";
    occurred_at?: Date;
  },
  tx?: DbExecutor
): Promise<void> {
  // 1. Validate the five-field audit contract at write time (raises ZodError if incomplete)
  const validated: ValidatedAuditEntry = AuditEntrySchema.parse({
    actor: input.actor,
    action: input.action,
    timestamp: (input.occurred_at || new Date()).toISOString(),
    reason: input.reason,
    result: input.result
  });

  const dbInstance = tx || getDb();

  // 2. Insert validated audit entry into the append-only table
  // We reuse the database audit_entry table and block UPDATE/DELETE via triggers, ensuring audit trails are immutable.
  await dbInstance.insert(auditEntry).values({
    tenant_id: input.tenant_id,
    case_id: input.case_id,
    actor: validated.actor,
    action: validated.action,
    reason: validated.reason,
    result: validated.result,
    occurred_at: new Date(validated.timestamp)
  });
}
