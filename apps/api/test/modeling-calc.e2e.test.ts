import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxEngineClient } from '../src/engine/calc-client.js';
import {
  clearStoredFiguresRepository,
  getStoredFiguresForCase,
  processModelingAndStoreFigures,
  ProblemDetailsError,
} from '../src/modeling/store-figures.js';

describe('Integrated Modeling → Calc End-to-End Slice', () => {
  const sampleToken = 'valid-tenant-jwt-token';
  const caseId = 'case-cycle-1001';

  beforeEach(() => {
    clearStoredFiguresRepository();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearStoredFiguresRepository();
    vi.restoreAllMocks();
  });

  it('successfully models a scenario on a Modeling-stage case, stores figures, and returns them on subsequent case read', async () => {
    const validEngineResponse = {
      federal_liability: 18000.0,
      state_liability: 6000.0,
      effective_rate: 0.2,
      marginal_rate: 0.24,
      quarterly_estimate: 6000.0,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(validEngineResponse), { status: 200 })
    );

    const client = new TaxEngineClient({
      baseUrl: 'http://localhost:8000',
      maxRetries: 3,
      initialDelayMs: 10,
    });

    const result = await processModelingAndStoreFigures(
      {
        case_id: caseId,
        stage: 'Modeling',
        filing_status: 'single',
        income: 100000.0,
        deductions: 12000.0,
        state: 'CA',
      },
      sampleToken,
      client
    );

    expect(result.case_id).toBe(caseId);
    expect(result.federal_liability).toBe(18000.0);
    expect(result.state_liability).toBe(6000.0);

    // Subsequent case read returns stored figures
    const stored = getStoredFiguresForCase(caseId);
    expect(stored).toBeDefined();
    expect(stored?.federal_liability).toBe(18000.0);
    expect(stored?.effective_rate).toBe(0.2);
  });

  it('handles calculation engine failure with a 502-class Problem Details error and leaves case stored state UNCHANGED', async () => {
    // Inject engine failure (network error / 503 unavailable)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Connection refused by tax engine');
    });

    const client = new TaxEngineClient({
      baseUrl: 'http://localhost:8000',
      maxRetries: 3,
      initialDelayMs: 10,
    });

    await expect(
      processModelingAndStoreFigures(
        {
          case_id: caseId,
          stage: 'Modeling',
          filing_status: 'single',
          income: 100000.0,
          deductions: 12000.0,
          state: 'CA',
        },
        sampleToken,
        client
      )
    ).rejects.toThrow(ProblemDetailsError);

    try {
      await processModelingAndStoreFigures(
        {
          case_id: caseId,
          stage: 'Modeling',
          filing_status: 'single',
          income: 100000.0,
          deductions: 12000.0,
          state: 'CA',
        },
        sampleToken,
        client
      );
    } catch (err) {
      expect(err).toBeInstanceOf(ProblemDetailsError);
      const prob = err as ProblemDetailsError;
      expect(prob.status).toBe(502);
      expect(prob.title).toBe('Bad Gateway');
      expect(prob.detail).toContain('Upstream calculation engine failure');
    }

    // Critical assertion: Case stored state MUST be unchanged (no partial write!)
    const stored = getStoredFiguresForCase(caseId);
    expect(stored).toBeUndefined();
  });

  it('rejects scenario modeling request if case is not in Modeling stage (e.g. Intake stage)', async () => {
    const client = new TaxEngineClient();

    await expect(
      processModelingAndStoreFigures(
        {
          case_id: caseId,
          stage: 'Intake',
          filing_status: 'single',
          income: 100000.0,
          deductions: 12000.0,
          state: 'CA',
        },
        sampleToken,
        client
      )
    ).rejects.toThrow(ProblemDetailsError);

    const stored = getStoredFiguresForCase(caseId);
    expect(stored).toBeUndefined();
  });

  it('rejects unauthenticated modeling request with a 401 Problem Details error', async () => {
    const client = new TaxEngineClient();

    await expect(
      processModelingAndStoreFigures(
        {
          case_id: caseId,
          stage: 'Modeling',
          filing_status: 'single',
          income: 100000.0,
          deductions: 12000.0,
          state: 'CA',
        },
        '', // Empty token
        client
      )
    ).rejects.toThrow(ProblemDetailsError);

    const stored = getStoredFiguresForCase(caseId);
    expect(stored).toBeUndefined();
  });
});
