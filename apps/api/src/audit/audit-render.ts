/**
 * Redacts income and deduction dollar figures at render time from audit logs.
 * Scans string fields and redacts numeric patterns, ensuring raw figures never leak.
 */
export function renderAuditEntry<T extends Record<string, any>>(entry: T): T {
  // Deep clone to avoid mutating the original database record
  const result = JSON.parse(JSON.stringify(entry));

  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string") {
      // Skip timestamps and IDs to preserve log metadata structure
      if (
        key === "timestamp" ||
        key === "occurred_at" ||
        key === "occurredAt" ||
        key === "id" ||
        key === "tenant_id" ||
        key === "tenantId" ||
        key === "case_id" ||
        key === "caseId"
      ) {
        continue;
      }

      // Replace numeric dollar figures/standalone numbers with [REDACTED]
      result[key] = val.replace(/\b\d+(?:\.\d+)?\b/g, "[REDACTED]");
    } else if (typeof val === "number") {
      result[key] = "[REDACTED]";
    } else if (val && typeof val === "object") {
      result[key] = renderAuditEntry(val);
    }
  }

  return result;
}
