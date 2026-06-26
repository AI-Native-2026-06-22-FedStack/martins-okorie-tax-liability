import { ZodError, type ZodType } from "zod";
import {
  DeductionSchema,
  HoldingSchema,
  IncomeEventSchema,
  TaxLiabilityScenarioInputSchema,
  type Deduction,
  type Holding,
  type IncomeEvent,
  type TaxLiabilityScenarioInput,
  type TaxPlanCycleAggregationPayload
} from "./tax-liability.schema.js";

export class TaxLiabilityTimeoutError extends Error {
  public constructor(timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms while loading Tax Plan Cycle data.`);
    this.name = "TaxLiabilityTimeoutError";
  }
}

export class TaxLiabilityValidationError extends Error {
  public readonly issues: ZodError["issues"];

  public constructor(
    public readonly panel: TaxPlanCycleDataPanel,
    error: ZodError
  ) {
    super(`Invalid ${panel} payload for Tax Plan Cycle modeling.`);
    this.name = "TaxLiabilityValidationError";
    this.issues = error.issues;
  }
}

export class TaxLiabilitySourceError extends Error {
  public constructor(
    public readonly panel: TaxPlanCycleDataPanel,
    cause: unknown
  ) {
    super(`Unable to load ${panel} payload for Tax Plan Cycle modeling.`, { cause });
    this.name = "TaxLiabilitySourceError";
  }
}

export type TaxPlanCycleDataPanel = "incomeEvents" | "deductions" | "holdings" | "scenarios";

export type PanelOutcome<Value> =
  | {
      readonly status: "fulfilled";
      readonly value: Value;
    }
  | {
      readonly status: "rejected";
      readonly reason:
        | TaxLiabilitySourceError
        | TaxLiabilityTimeoutError
        | TaxLiabilityValidationError;
    };

export interface TaxPlanCycleInputCollection {
  readonly incomeEvents: PanelOutcome<IncomeEvent[]>;
  readonly deductions: PanelOutcome<Deduction[]>;
  readonly holdings: PanelOutcome<Holding[]>;
  readonly scenarios: PanelOutcome<TaxLiabilityScenarioInput[]>;
}

export interface TaxLiabilityScenarioResult {
  readonly scenarioId: string;
  readonly label: string;
  readonly projectedTaxLiability: number;
  readonly projectedNetIncomeAfterDeductions: number;
}

export interface TaxPlanCycleModelingResult {
  readonly payload: TaxPlanCycleAggregationPayload;
  readonly totalHoldingMarketValue: number;
  readonly scenarioResults: TaxLiabilityScenarioResult[];
}

export interface TaxPlanCycleDataSource {
  readonly loadIncomeEvents: () => Promise<unknown>;
  readonly loadDeductions: () => Promise<unknown>;
  readonly loadHoldings: () => Promise<unknown>;
  readonly loadScenarios: () => Promise<unknown>;
}

export interface MockTaxPlanCycleDataSourceOptions {
  readonly payload: TaxPlanCycleAggregationPayload;
  readonly latencyMsByPanel?: Partial<Record<TaxPlanCycleDataPanel, number>>;
  readonly rejectedPanels?: Partial<Record<TaxPlanCycleDataPanel, unknown>>;
}

export interface TaxPlanCycleModelingClient {
  readonly collectInputs: (timeoutMs: number) => Promise<TaxPlanCycleInputCollection>;
  readonly modelScenarios: (timeoutMs: number) => Promise<TaxPlanCycleModelingResult>;
}

const sleep = async (durationMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const withTimeout = async <Result>(work: Promise<Result>, timeoutMs: number): Promise<Result> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TaxLiabilityTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizePanelError = (
  panel: TaxPlanCycleDataPanel,
  error: unknown
): TaxLiabilitySourceError | TaxLiabilityTimeoutError | TaxLiabilityValidationError => {
  if (error instanceof TaxLiabilityTimeoutError) {
    return error;
  }

  if (error instanceof TaxLiabilityValidationError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new TaxLiabilityValidationError(panel, error);
  }

  return new TaxLiabilitySourceError(panel, error);
};

const loadPanel = async <Value>(
  panel: TaxPlanCycleDataPanel,
  loader: () => Promise<unknown>,
  schema: ZodType<Value>,
  timeoutMs: number
): Promise<Value> => {
  const rawPayload = await withTimeout(loader(), timeoutMs);
  return schema.parse(rawPayload);
};

const toPanelOutcome = <Value>(
  panel: TaxPlanCycleDataPanel,
  result: PromiseSettledResult<Value>
): PanelOutcome<Value> => {
  if (result.status === "fulfilled") {
    return {
      status: "fulfilled",
      value: result.value
    };
  }

  return {
    status: "rejected",
    reason: normalizePanelError(panel, result.reason)
  };
};

const requirePanel = <Value>(outcome: PanelOutcome<Value>): Value => {
  if (outcome.status === "fulfilled") {
    return outcome.value;
  }

  throw outcome.reason;
};

const sumByAmount = <Item extends { readonly amount: number }>(items: Item[]): number =>
  items.reduce((total, item) => total + item.amount, 0);

const calculateScenarioResults = (
  incomeEvents: IncomeEvent[],
  deductions: Deduction[],
  scenarios: TaxLiabilityScenarioInput[]
): TaxLiabilityScenarioResult[] => {
  const baseIncome = sumByAmount(incomeEvents);
  const baseDeductions = sumByAmount(deductions);

  return scenarios.map((scenario) => {
    const projectedIncome = baseIncome + scenario.projectedAdditionalIncome;
    const projectedDeductions = baseDeductions + scenario.projectedAdditionalDeductions;
    const projectedNetIncomeAfterDeductions = projectedIncome - projectedDeductions;
    const taxableAmount = Math.max(projectedNetIncomeAfterDeductions, 0);

    return {
      scenarioId: scenario.scenarioId,
      label: scenario.label,
      projectedTaxLiability: taxableAmount * scenario.effectiveTaxRate,
      projectedNetIncomeAfterDeductions
    };
  });
};

const sumHoldingMarketValue = (holdings: Holding[]): number =>
  holdings.reduce((total, holding) => total + holding.marketValue, 0);

export const createMockTaxPlanCycleDataSource = ({
  payload,
  latencyMsByPanel = {},
  rejectedPanels = {}
}: MockTaxPlanCycleDataSourceOptions): TaxPlanCycleDataSource => {
  const loadPanelPayload = async (panel: TaxPlanCycleDataPanel): Promise<unknown> => {
    await sleep(latencyMsByPanel[panel] ?? 0);

    if (panel in rejectedPanels) {
      throw rejectedPanels[panel];
    }

    return payload[panel];
  };

  return {
    loadIncomeEvents: async (): Promise<unknown> => loadPanelPayload("incomeEvents"),
    loadDeductions: async (): Promise<unknown> => loadPanelPayload("deductions"),
    loadHoldings: async (): Promise<unknown> => loadPanelPayload("holdings"),
    loadScenarios: async (): Promise<unknown> => loadPanelPayload("scenarios")
  };
};

export const createTaxPlanCycleModelingClient = (
  source: TaxPlanCycleDataSource,
  taxPlanCycle: TaxPlanCycleAggregationPayload["taxPlanCycle"]
): TaxPlanCycleModelingClient => {
  const collectInputs = async (timeoutMs: number): Promise<TaxPlanCycleInputCollection> => {
    const [incomeEvents, deductions, holdings, scenarios] = await Promise.allSettled([
      loadPanel("incomeEvents", source.loadIncomeEvents, IncomeEventSchema.array(), timeoutMs),
      loadPanel("deductions", source.loadDeductions, DeductionSchema.array(), timeoutMs),
      loadPanel("holdings", source.loadHoldings, HoldingSchema.array(), timeoutMs),
      loadPanel(
        "scenarios",
        source.loadScenarios,
        TaxLiabilityScenarioInputSchema.array().min(2).max(5),
        timeoutMs
      )
    ]);

    return {
      incomeEvents: toPanelOutcome("incomeEvents", incomeEvents),
      deductions: toPanelOutcome("deductions", deductions),
      holdings: toPanelOutcome("holdings", holdings),
      scenarios: toPanelOutcome("scenarios", scenarios)
    };
  };

  return {
    collectInputs,
    modelScenarios: async (timeoutMs: number): Promise<TaxPlanCycleModelingResult> => {
      const inputs = await collectInputs(timeoutMs);
      const incomeEvents = requirePanel(inputs.incomeEvents);
      const deductions = requirePanel(inputs.deductions);
      const holdings = requirePanel(inputs.holdings);
      const scenarios = requirePanel(inputs.scenarios);

      const payload = {
        taxPlanCycle,
        incomeEvents,
        deductions,
        holdings,
        scenarios
      } satisfies TaxPlanCycleAggregationPayload;

      return {
        payload,
        totalHoldingMarketValue: sumHoldingMarketValue(holdings),
        scenarioResults: calculateScenarioResults(incomeEvents, deductions, scenarios)
      };
    }
  };
};
