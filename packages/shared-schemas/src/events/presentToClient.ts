import { z } from "zod";

/**
 * Presented-to-client is a past-fact event: a Tax Plan Cycle was already
 * presented to the client and its action items are ready for portal projection.
 */
export const presentToClientSchemaVersion = "v1";
export const presentToClientEventType = "com.taxpulse.tax-plan-cycle.presented-to-client.v1";
export const presentToClientEventSource = "/taxpulse/core-case-service";

export const presentToClientActionItemSchema = z.object({
  description: z.string().trim().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const presentToClientEventDataSchema = z.object({
  tenant_id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  presented_by: z.string().min(1),
  presented_at: z.string().datetime(),
  action_items: z.array(presentToClientActionItemSchema).min(1)
});

export const presentToClientCloudEventSchema = z.object({
  specversion: z.literal("1.0"),
  id: z.string().uuid(),
  source: z.literal(presentToClientEventSource),
  type: z.literal(presentToClientEventType),
  time: z.string().datetime(),
  subject: z.string().regex(/^tax-plan-cycle\/[0-9a-f-]{36}$/),
  datacontenttype: z.literal("application/json"),
  data: presentToClientEventDataSchema
});

export function parsePresentToClientCloudEvent(input: unknown): PresentToClientCloudEvent {
  return presentToClientCloudEventSchema.parse(input);
}

export function validatePresentToClientCloudEvent(input: unknown): boolean {
  return presentToClientCloudEventSchema.safeParse(input).success;
}

export type PresentToClientActionItem = z.infer<typeof presentToClientActionItemSchema>;
export type PresentToClientEventData = z.infer<typeof presentToClientEventDataSchema>;
export type PresentToClientCloudEvent = z.infer<typeof presentToClientCloudEventSchema>;
