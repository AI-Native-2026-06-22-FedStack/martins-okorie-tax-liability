import { describe, expect, it } from "vitest";
import { validateStageTransition } from "./stage-transition.js";
import type { TaxPlanCycleStage } from "./tax-liability.schema.js";

describe("validateStageTransition", () => {
  it("allows every legal forward Tax Plan Cycle stage transition", () => {
    // Arrange
    const legalForwardTransitions: Array<{
      readonly fromStage: TaxPlanCycleStage;
      readonly toStage: TaxPlanCycleStage;
    }> = [
      { fromStage: "Intake", toStage: "Data Aggregation" },
      { fromStage: "Data Aggregation", toStage: "Modeling" },
      { fromStage: "Modeling", toStage: "Review" },
      { fromStage: "Review", toStage: "Client Approval" },
      { fromStage: "Client Approval", toStage: "Executed" },
      { fromStage: "Executed", toStage: "Archived" }
    ];

    for (const { fromStage, toStage } of legalForwardTransitions) {
      // Act
      const isAllowed = validateStageTransition(fromStage, toStage);

      // Assert
      expect(isAllowed).toBe(true);
    }
  });

  it("rejects skipped Tax Plan Cycle stage transitions", () => {
    // Arrange
    const skippedTransitions: Array<{
      readonly fromStage: TaxPlanCycleStage;
      readonly toStage: TaxPlanCycleStage;
    }> = [
      { fromStage: "Intake", toStage: "Modeling" },
      { fromStage: "Data Aggregation", toStage: "Review" },
      { fromStage: "Review", toStage: "Executed" },
      { fromStage: "Client Approval", toStage: "Archived" }
    ];

    for (const { fromStage, toStage } of skippedTransitions) {
      // Act
      const isAllowed = validateStageTransition(fromStage, toStage);

      // Assert
      expect(isAllowed).toBe(false);
    }
  });
});
