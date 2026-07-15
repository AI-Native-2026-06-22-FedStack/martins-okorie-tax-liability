import { z } from "zod";

/**
 * Five-field audit schema every audit entry must satisfy.
 * Enforces rigid validation at write time so incomplete logs are rejected.
 */
export const AuditEntrySchema = z.object({
  actor: z.string().min(1, "Actor is required"),
  action: z.string().min(1, "Action is required"),
  timestamp: z.string().datetime({ message: "Invalid ISO 8601 datetime format" }),
  reason: z.string().min(1, "Reason is required"),
  result: z.enum(["success", "failure"])
});

export type ValidatedAuditEntry = z.infer<typeof AuditEntrySchema>;
