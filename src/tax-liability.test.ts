import { describe, expect, it } from "vitest";
import {
  TaxLiabilitySourceError,
  TaxLiabilityTimeoutError,
  TaxLiabilityValidationError,
  createMockTaxPlanCycleDataSource,
  createTaxPlanCycleModelingClient
} from "./tax-liability.js";
import {
  defaultTaxPlanCycleValues,
  type TaxPlanCycleAggregationPayload
} from "./tax-liability.schema.js";

const validPayload: TaxPlanCycleAggregationPayload = {
  taxPlanCycle: {
    taxPlanCycleId: "cycle-fictional-2026-q1",
    tenantWorkspaceId: "tenant-fictional-advisory",
    advisorId: "advisor-fictional-1",
    clientId: "client-fictional-1",
    planningPeriod: "2026-Q1",
    due_date: "2026-04-15",
    ...defaultTaxPlanCycleValues
  },
  incomeEvents: [
    {
      eventId: "income-fictional-1",
      amount: 120000,
      occurredOn: "2026-01-15T00:00:00.000Z"
    },
    {
      eventId: "income-fictional-2",
      amount: 3500,
      occurredOn: "2026-02-01T00:00:00.000Z"
    }
  ],
  deductions: [
    {
      deductionId: "deduction-fictional-1",
      amount: 24000,
      incurredOn: "2026-03-01T00:00:00.000Z"
    }
  ],
  holdings: [
    {
      holdingId: "holding-fictional-1",
      unrealizedGain: 15000,
      marketValue: 250000
    }
  ],
  scenarios: [
    {
      scenarioId: "scenario-fictional-baseline",
      label: "Baseline",
      projectedAdditionalIncome: 0,
      projectedAdditionalDeductions: 0,
      effectiveTaxRate: 0.24
    },
    {
      scenarioId: "scenario-fictional-deduction",
      label: "Deduction timing",
      projectedAdditionalIncome: 0,
      projectedAdditionalDeductions: 10000,
      effectiveTaxRate: 0.24
    }
  ]
};

describe("createTaxPlanCycleModelingClient", () => {
  it("models 2-5 Tax Plan Cycle scenarios from validated async inputs", async () => {
    const source = createMockTaxPlanCycleDataSource({
      payload: validPayload
    });
    const client = createTaxPlanCycleModelingClient(source, validPayload.taxPlanCycle);

    await expect(client.modelScenarios(50)).resolves.toEqual({
      payload: validPayload,
      totalHoldingMarketValue: 250000,
      scenarioResults: [
        {
          scenarioId: "scenario-fictional-baseline",
          label: "Baseline",
          projectedTaxLiability: 23880,
          projectedNetIncomeAfterDeductions: 99500
        },
        {
          scenarioId: "scenario-fictional-deduction",
          label: "Deduction timing",
          projectedTaxLiability: 21480,
          projectedNetIncomeAfterDeductions: 89500
        }
      ]
    });
  });

  it("uses allSettled so one rejected panel does not discard other outcomes", async () => {
    const source = createMockTaxPlanCycleDataSource({
      payload: validPayload,
      rejectedPanels: {
        holdings: new Error("fictional holdings source failed")
      }
    });
    const client = createTaxPlanCycleModelingClient(source, validPayload.taxPlanCycle);

    const inputs = await client.collectInputs(50);

    expect(inputs.incomeEvents.status).toBe("fulfilled");
    expect(inputs.deductions.status).toBe("fulfilled");
    expect(inputs.scenarios.status).toBe("fulfilled");
    expect(inputs.holdings.status).toBe("rejected");

    if (inputs.holdings.status === "rejected") {
      expect(inputs.holdings.reason).toBeInstanceOf(TaxLiabilitySourceError);
    }
  });

  it("rejects malformed source payloads with a typed validation error", async () => {
    const source = createMockTaxPlanCycleDataSource({
      payload: {
        ...validPayload,
        scenarios: [
          {
            scenarioId: "scenario-fictional-invalid",
            label: "Invalid negative projection",
            projectedAdditionalIncome: -1,
            projectedAdditionalDeductions: 0,
            effectiveTaxRate: 0.24
          },
          {
            scenarioId: "scenario-fictional-valid-comparison",
            label: "Valid comparison",
            projectedAdditionalIncome: 0,
            projectedAdditionalDeductions: 10000,
            effectiveTaxRate: 0.24
          }
        ]
      }
    });
    const client = createTaxPlanCycleModelingClient(source, validPayload.taxPlanCycle);

    await expect(client.modelScenarios(50)).rejects.toBeInstanceOf(TaxLiabilityValidationError);
  });

  it("rejects slow source panels with a typed timeout error", async () => {
    const source = createMockTaxPlanCycleDataSource({
      payload: validPayload,
      latencyMsByPanel: {
        incomeEvents: 25
      }
    });
    const client = createTaxPlanCycleModelingClient(source, validPayload.taxPlanCycle);

    await expect(client.modelScenarios(1)).rejects.toBeInstanceOf(TaxLiabilityTimeoutError);
  });
});
