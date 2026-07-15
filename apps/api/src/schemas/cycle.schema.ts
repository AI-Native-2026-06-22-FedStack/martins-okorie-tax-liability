import { z } from "zod";

export const CycleStageSchema = z.enum([
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived"
]);

export const CreateCycleRequestSchema = z.object({
  client_id: z.string().min(1),
  due_date: z.iso.date(),
  hold_reason: z.string().min(1).nullable().optional(),
  on_hold: z.boolean().default(false),
  owner: z.string().min(1),
  planning_period: z.string().min(1),
  priority: z.string().min(1)
});

export const CycleResponseSchema = z.object({
  client_id: z.string().min(1),
  created_at: z.iso.datetime(),
  due_date: z.iso.date(),
  hold_reason: z.string().min(1).nullable(),
  id: z.uuid(),
  on_hold: z.boolean(),
  owner: z.string().min(1),
  planning_period: z.string().min(1),
  priority: z.string().min(1),
  stage: CycleStageSchema,
  tenant_id: z.uuid(),
  updated_at: z.iso.datetime()
});

export const CycleIdParamsSchema = z.object({
  id: z.uuid()
});

export const TenantContextSchema = z.object({
  tenant_id: z.uuid()
});

export type CreateCycleRequest = z.infer<typeof CreateCycleRequestSchema>;
export type CycleResponse = z.infer<typeof CycleResponseSchema>;
export type CycleIdParams = z.infer<typeof CycleIdParamsSchema>;
export type TenantContext = z.infer<typeof TenantContextSchema>;
