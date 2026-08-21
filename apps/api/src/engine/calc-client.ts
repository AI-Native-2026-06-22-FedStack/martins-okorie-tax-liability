import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';

const schemaPath = resolve(
  process.cwd(),
  'packages/shared-schemas/calculation.schema.json'
);
const schemaContent = readFileSync(schemaPath, 'utf-8');
const calculationSchema = JSON.parse(schemaContent);

export class UpstreamEngineError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 502,
    public readonly isTransient: boolean = false
  ) {
    super(message);
    this.name = 'UpstreamEngineError';
  }
}

export interface CalculationRequestPayload {
  filing_status: string;
  income: number;
  deductions: number;
  state: string;
}

export interface CalculationResponsePayload {
  federal_liability: number;
  state_liability: number;
  effective_rate: number;
  marginal_rate: number;
  quarterly_estimate: number;
}

// Retry bound = 3, initial backoff = 100ms with jitter: bounds transient retries under 1s total while preventing thundering-herd stampedes.
export class TaxEngineClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly validateResponse: ReturnType<Ajv['compile']>;

  constructor(options?: {
    baseUrl?: string;
    timeoutMs?: number;
    maxRetries?: number;
    initialDelayMs?: number;
  }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.COMPUTE_SERVICE_URL ||
      'http://localhost:8000'
    ).replace(/\/$/, '');
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.maxRetries = options?.maxRetries ?? 3;
    this.initialDelayMs = options?.initialDelayMs ?? 100;

    const ajv = new Ajv();
    this.validateResponse = ajv.compile(
      calculationSchema.$defs.calculationResponse
    );
  }

  async calculateTaxLiability(
    payload: CalculationRequestPayload,
    authToken: string,
    traceContext?: { traceId?: string; correlationId?: string }
  ): Promise<CalculationResponsePayload> {
    let lastError: Error | null = null;
    let lastStatusCode = 503;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    if (traceContext?.traceId) {
      headers['X-Amzn-Trace-Id'] = `Root=${traceContext.traceId};Sampled=1`;
    }
    if (traceContext?.correlationId) {
      headers['x-correlation-id'] = traceContext.correlationId;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/v1/calculate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          const json = (await response.json()) as Record<string, unknown>;
          const valid = this.validateResponse(json);
          if (!valid) {
            throw new UpstreamEngineError(
              'Malformed response schema from tax engine',
              502,
              false
            );
          }
          return json as unknown as CalculationResponsePayload;
        }

        lastStatusCode = response.status;

        // 4xx errors are client/contract errors — DO NOT RETRY
        if (response.status >= 400 && response.status < 500) {
          const errorText = await response.text().catch(() => '');
          throw new UpstreamEngineError(
            `Client error from tax engine (${response.status}): ${errorText || response.statusText}`,
            response.status,
            false
          );
        }

        // 5xx errors are transient server errors — eligible for retry
        lastError = new UpstreamEngineError(
          `Server error from tax engine (${response.status}): ${response.statusText}`,
          response.status,
          true
        );
      } catch (err) {
        clearTimeout(timer);

        if (err instanceof UpstreamEngineError && !err.isTransient) {
          throw err;
        }

        lastError =
          err instanceof Error
            ? err
            : new Error(String(err) || 'Unknown fetch failure');
      }

      // Exponential backoff + random jitter for transient failures
      if (attempt < this.maxRetries) {
        const backoff =
          this.initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw new UpstreamEngineError(
      `Tax calculation engine unavailable after ${this.maxRetries} attempts: ${lastError?.message || 'Upstream timeout or failure'}`,
      lastStatusCode,
      true
    );
  }
}
