import {
  TaxEngineClient,
  UpstreamEngineError,
  type CalculationResponsePayload,
} from '../engine/calc-client.js';

export interface ProblemDetails {
  status: number;
  title: string;
  detail: string;
  instance: string;
  type: string;
}

export class ProblemDetailsError extends Error implements ProblemDetails {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly instance: string = 'about:blank',
    public readonly type: string = 'about:blank'
  ) {
    super(detail);
    this.name = 'ProblemDetailsError';
  }
}

export interface ModelingRequest {
  case_id: string;
  stage: string;
  filing_status: string;
  income: number;
  deductions: number;
  state: string;
}

export interface StoredFigures {
  case_id: string;
  stage: string;
  federal_liability: number;
  state_liability: number;
  effective_rate: number;
  marginal_rate: number;
  quarterly_estimate: number;
  calculated_at: string;
}

const storedFiguresRepository = new Map<string, StoredFigures>();

export function getStoredFiguresForCase(
  case_id: string
): StoredFigures | undefined {
  return storedFiguresRepository.get(case_id);
}

export function clearStoredFiguresRepository(): void {
  storedFiguresRepository.clear();
}

export async function processModelingAndStoreFigures(
  req: ModelingRequest,
  authToken: string,
  client?: TaxEngineClient
): Promise<StoredFigures> {
  // 1. Auth check
  if (!authToken) {
    throw new ProblemDetailsError(
      401,
      'Unauthorized',
      'Missing or invalid tenant authentication token',
      `/v1/cases/${req.case_id}/model`
    );
  }

  // 2. Stage guardrail: Must be in 'Modeling' stage
  if (req.stage !== 'Modeling') {
    throw new ProblemDetailsError(
      422,
      'Unprocessable Entity',
      `Case must be in 'Modeling' stage, but current stage is '${req.stage}'`,
      `/v1/cases/${req.case_id}/model`
    );
  }

  const engineClient = client || new TaxEngineClient();

  // 3. Call calculation engine over hardened client
  let response: CalculationResponsePayload;
  try {
    response = await engineClient.calculateTaxLiability(
      {
        filing_status: req.filing_status,
        income: req.income,
        deductions: req.deductions,
        state: req.state,
      },
      authToken
    );
  } catch (err) {
    // Engine failure surfaces as a 502-class Problem Details error.
    // Case stored state remains UNCHANGED — no partial write!
    const detailMessage =
      err instanceof UpstreamEngineError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Upstream tax calculation engine unavailable';

    throw new ProblemDetailsError(
      502,
      'Bad Gateway',
      `Upstream calculation engine failure: ${detailMessage}`,
      `/v1/cases/${req.case_id}/model`
    );
  }

  // 4. Store returned figures so a subsequent case read returns them
  const stored: StoredFigures = {
    case_id: req.case_id,
    stage: req.stage,
    federal_liability: response.federal_liability,
    state_liability: response.state_liability,
    effective_rate: response.effective_rate,
    marginal_rate: response.marginal_rate,
    quarterly_estimate: response.quarterly_estimate,
    calculated_at: new Date().toISOString(),
  };

  storedFiguresRepository.set(req.case_id, stored);

  return stored;
}
