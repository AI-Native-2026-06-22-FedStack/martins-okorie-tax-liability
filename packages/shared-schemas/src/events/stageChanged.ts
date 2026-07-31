import { z } from "zod";

/**
 * Stage-changed is a past-fact event: a Tax Plan Cycle already moved from one
 * workflow stage to another. It is not a command to advance, notify, or act.
 */
export const stageChangedSchemaVersion = "v1";
export const stageChangedEventType = "com.taxpulse.tax-plan-cycle.stage.changed.v1";
export const stageChangedEventSource = "/taxpulse/core-case-service";

export const taxPlanCycleStageSchema = z.enum([
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived",
]);

export const stageChangedEventDataSchema = z.object({
  tenant_id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  from_stage: taxPlanCycleStageSchema.nullable(),
  to_stage: taxPlanCycleStageSchema,
  changed_by: z.string().min(1),
  changed_at: z.string().datetime(),
});

export const stageChangedCloudEventSchema = z.object({
  specversion: z.literal("1.0"),
  id: z.string().uuid(),
  source: z.literal(stageChangedEventSource),
  type: z.literal(stageChangedEventType),
  time: z.string().datetime(),
  subject: z.string().regex(/^tax-plan-cycle\/[0-9a-f-]{36}$/),
  datacontenttype: z.literal("application/json"),
  data: stageChangedEventDataSchema,
});

export function parseStageChangedCloudEvent(input: unknown): StageChangedCloudEvent {
  return stageChangedCloudEventSchema.parse(input);
}

export function validateStageChangedCloudEvent(input: unknown): boolean {
  return stageChangedCloudEventSchema.safeParse(input).success;
}

export type TaxPlanCycleStage = z.infer<typeof taxPlanCycleStageSchema>;
export type StageChangedEventData = z.infer<typeof stageChangedEventDataSchema>;
export type StageChangedCloudEvent = z.infer<typeof stageChangedCloudEventSchema>;
