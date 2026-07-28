import { z } from "zod";

export const planCyclePrioritySchema = z.enum(["High", "Medium", "Low"]);

export const createPlanCycleSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client identifier is required."),
    planning_period: z.string().trim().min(1, "Planning period is required."),
    owner: z.string().trim().min(1, "Owner is required."),
    priority: planCyclePrioritySchema,
    due_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must use YYYY-MM-DD format."),
    on_hold: z.boolean().default(false),
    hold_reason: z
      .string()
      .trim()
      .min(1, "Hold reason cannot be blank.")
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.on_hold && !value.hold_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hold reason is required when the cycle is on hold.",
        path: ["hold_reason"],
      });
    }
  });

export type CreatePlanCycleInput = z.infer<typeof createPlanCycleSchema>;
export type PlanCyclePriority = z.infer<typeof planCyclePrioritySchema>;
