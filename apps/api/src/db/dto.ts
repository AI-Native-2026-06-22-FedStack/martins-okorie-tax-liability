import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { taxPlanCycle } from "./schema.js";

// The API create body excludes server/database-managed fields and internal metadata.
export const CreateCycleRequestSchema = createInsertSchema(taxPlanCycle, {
  client_id: (schema) => schema.min(1),
  due_date: z.iso.date(),
  hold_reason: z.string().min(1).nullable().optional(),
  on_hold: z.boolean().default(false),
  owner: (schema) => schema.min(1),
  planning_period: (schema) => schema.min(1),
  priority: (schema) => schema.min(1)
}).omit({
  created_at: true,
  id: true,
  metadata: true,
  stage: true,
  tenant_id: true,
  updated_at: true
});

export const CycleResponseSchema = createSelectSchema(taxPlanCycle);

export const CreateCycleResponseSchema = z.object({
  id: z.uuid()
});

export const CycleIdParamsSchema = z.object({
  id: z.uuid()
});

export const TenantContextSchema = z.object({
  tenant_id: z.uuid()
});

export const ListPlanCycleQueueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  owner: z.string().min(1).optional(),
  stage: z.enum(taxPlanCycle.stage.enumValues)
});

export type CreateCycleRequest = z.infer<typeof CreateCycleRequestSchema>;
export type CreateCycleResponse = z.infer<typeof CreateCycleResponseSchema>;
export type CycleResponse = z.infer<typeof CycleResponseSchema>;
export type CycleIdParams = z.infer<typeof CycleIdParamsSchema>;
export type TenantContext = z.infer<typeof TenantContextSchema>;
export type ListPlanCycleQueueQuery = z.infer<typeof ListPlanCycleQueueQuerySchema>;
