import { z } from "zod";

const NonNegativeAmountSchema = z.number().finite().nonnegative();

export const TaxPlanCycleStageSchema = z.enum([
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived"
]);

export const TaxPlanCycleSchema = z
  .object({
    taxPlanCycleId: z.string().min(1),
    tenantWorkspaceId: z.string().min(1),
    advisorId: z.string().min(1),
    clientId: z.string().min(1),
    planningPeriod: z.string().min(1),
    stage: TaxPlanCycleStageSchema,
    on_hold: z.boolean(),
    hold_reason: z.string().min(1).optional(),
    due_date: z.string().date(),
    priority: z.enum(["low", "normal", "high"])
  })
  .strict();

export const IncomeEventSchema = z
  .object({
    eventId: z.string().min(1),
    amount: NonNegativeAmountSchema,
    occurredOn: z.string().datetime()
  })
  .strict();

export const DeductionSchema = z
  .object({
    deductionId: z.string().min(1),
    amount: NonNegativeAmountSchema,
    incurredOn: z.string().datetime()
  })
  .strict();

export const HoldingSchema = z
  .object({
    holdingId: z.string().min(1),
    unrealizedGain: z.number().finite(),
    marketValue: NonNegativeAmountSchema
  })
  .strict();

export const TaxLiabilityScenarioInputSchema = z
  .object({
    scenarioId: z.string().min(1),
    label: z.string().min(1),
    projectedAdditionalIncome: NonNegativeAmountSchema,
    projectedAdditionalDeductions: NonNegativeAmountSchema,
    effectiveTaxRate: z.number().finite().min(0).max(1)
  })
  .strict();

export const TaxPlanCycleAggregationPayloadSchema = z
  .object({
    taxPlanCycle: TaxPlanCycleSchema,
    incomeEvents: z.array(IncomeEventSchema),
    deductions: z.array(DeductionSchema),
    holdings: z.array(HoldingSchema),
    scenarios: z.array(TaxLiabilityScenarioInputSchema).min(2).max(5)
  })
  .strict();

export type TaxPlanCycleStage = z.infer<typeof TaxPlanCycleStageSchema>;
export type TaxPlanCycle = z.infer<typeof TaxPlanCycleSchema>;
export type IncomeEvent = z.infer<typeof IncomeEventSchema>;
export type Deduction = z.infer<typeof DeductionSchema>;
export type Holding = z.infer<typeof HoldingSchema>;
export type TaxLiabilityScenarioInput = z.infer<typeof TaxLiabilityScenarioInputSchema>;
export type TaxPlanCycleAggregationPayload = z.infer<typeof TaxPlanCycleAggregationPayloadSchema>;

export type CreateTaxPlanCycleInput = Omit<TaxPlanCycle, "taxPlanCycleId">;
export type PatchTaxPlanCycleInput = Partial<TaxPlanCycle>;
export type TaxPlanCycleSummary = Pick<
  TaxPlanCycle,
  "taxPlanCycleId" | "advisorId" | "clientId" | "planningPeriod" | "stage" | "due_date"
>;

export const defaultTaxPlanCycleValues = {
  stage: "Intake",
  on_hold: false,
  priority: "normal"
} as const satisfies Pick<TaxPlanCycle, "stage" | "on_hold" | "priority">;
