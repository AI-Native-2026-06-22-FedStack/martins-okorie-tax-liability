import type { TaxPlanCycleStage } from "./tax-liability.schema.js";

const legalNextStageByCurrentStage: Record<TaxPlanCycleStage, TaxPlanCycleStage | undefined> = {
  Intake: "Data Aggregation",
  "Data Aggregation": "Modeling",
  Modeling: "Review",
  Review: "Client Approval",
  "Client Approval": "Executed",
  Executed: "Archived",
  Archived: undefined
};

export const validateStageTransition = (
  fromStage: TaxPlanCycleStage,
  toStage: TaxPlanCycleStage
): boolean => legalNextStageByCurrentStage[fromStage] === toStage;
