import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TaxEngineClient,
  UpstreamEngineError,
} from '../src/engine/calc-client.js';

describe('TaxEngineClient Inter-Service Call Hardening', () => {
  const defaultPayload = {
    filing_status: 'single',
    income: 120000.0,
    deductions: 14600.0,
    state: 'CA',
  };

  const validResponse = {
    federal_liability: 18000.0,
    state_liability: 6000.0,
    effective_rate: 0.2,
    marginal_rate: 0.24,
    quarterly_estimate: 6000.0,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully calls engine and validates response payload against shared JSON schema', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(validResponse), { status: 200 }));

    const client = new TaxEngineClient({ baseUrl: 'http://localhost:8000', maxRetries: 3, initialDelayMs: 10 });
    const result = await client.calculateTaxLiability(defaultPayload, 'valid-token');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(validResponse);
  });

  it('attempts capped 3 times with growing jittered delays when engine is down, then raises UpstreamEngineError', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        throw new Error('Connection refused');
      });

    const client = new TaxEngineClient({ baseUrl: 'http://localhost:8000', maxRetries: 3, initialDelayMs: 10 });

    const startTime = Date.now();
    await expect(
      client.calculateTaxLiability(defaultPayload, 'valid-token')
    ).rejects.toThrow(UpstreamEngineError);
    const duration = Date.now() - startTime;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(duration).toBeGreaterThanOrEqual(20);
  });

  it('recovers on 2nd attempt after a transient 503 server error', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validResponse), { status: 200 }));

    const client = new TaxEngineClient({ baseUrl: 'http://localhost:8000', maxRetries: 3, initialDelayMs: 10 });
    const result = await client.calculateTaxLiability(defaultPayload, 'valid-token');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual(validResponse);
  });

  it('fails immediately on 4xx error (e.g. 401/422) without retrying', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Unauthenticated' }), { status: 401, statusText: 'Unauthorized' }));

    const client = new TaxEngineClient({ baseUrl: 'http://localhost:8000', maxRetries: 3, initialDelayMs: 10 });

    await expect(
      client.calculateTaxLiability(defaultPayload, 'invalid-token')
    ).rejects.toThrow(UpstreamEngineError);

    // 4xx errors are not transient, so fetch should be called exactly once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('raises boundary UpstreamEngineError when engine returns malformed response schema', async () => {
    const malformedResponse = {
      federal_liability: 'not-a-number',
      state_liability: 6000.0,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(malformedResponse), { status: 200 })
    );

    const client = new TaxEngineClient({ baseUrl: 'http://localhost:8000', maxRetries: 3, initialDelayMs: 10 });

    await expect(
      client.calculateTaxLiability(defaultPayload, 'valid-token')
    ).rejects.toThrow('Malformed response schema from tax engine');
  });
});
