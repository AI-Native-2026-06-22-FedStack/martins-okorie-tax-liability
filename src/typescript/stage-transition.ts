import type { TaxPlanCycleStage } from "./tax-liability.schema.js";

const allowedTargetStagesByCurrentStage: Record<
  TaxPlanCycleStage,
  readonly TaxPlanCycleStage[]
> = {
  Intake: ["Data Aggregation"],
  "Data Aggregation": ["Modeling"],
  Modeling: ["Review"],
  Review: ["Client Approval", "Modeling"],
  "Client Approval": ["Executed"],
  Executed: ["Archived"],
  Archived: []
};

export const validateStageTransition = (
  fromStage: TaxPlanCycleStage,
  toStage: TaxPlanCycleStage
): boolean => allowedTargetStagesByCurrentStage[fromStage].includes(toStage);
