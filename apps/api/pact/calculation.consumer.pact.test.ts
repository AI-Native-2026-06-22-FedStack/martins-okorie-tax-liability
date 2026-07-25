import { resolve } from 'node:path';
import { MatchersV3, PactV4, Publisher } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import { TaxEngineClient } from '../src/engine/calc-client.js';

describe('Core → Tax Calculation Pact Consumer Test', () => {
  const pact = new PactV4({
    consumer: 'taxpulse-api',
    provider: 'compute-engine',
    dir: resolve(process.cwd(), 'pacts'),
  });

  const sampleToken = 'test-jwt-token-123';

  it('generates pact for POST /v1/calculate single calculation endpoint', async () => {
    const requestPayload = {
      filing_status: 'single',
      income: 100000.0,
      deductions: 12000.0,
      state: 'CA',
    };

    const expectedResponseBody = {
      federal_liability: MatchersV3.number(18000.0),
      state_liability: MatchersV3.number(6000.0),
      effective_rate: MatchersV3.number(0.24),
      marginal_rate: MatchersV3.number(0.24),
      quarterly_estimate: MatchersV3.number(6000.0),
    };

    await pact
      .addInteraction()
      .uponReceiving('a request for a single tax calculation')
      .withRequest('POST', '/v1/calculate', (builder) => {
        builder.headers({
          Authorization: `Bearer ${sampleToken}`,
          'Content-Type': 'application/json',
        });
        builder.jsonBody(requestPayload);
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(expectedResponseBody);
      })
      .executeTest(async (mockServer) => {
        // Drive REAL TaxEngineClient against mock server URL
        const client = new TaxEngineClient({
          baseUrl: mockServer.url,
          maxRetries: 1,
          initialDelayMs: 10,
        });

        const result = await client.calculateTaxLiability(
          requestPayload,
          sampleToken
        );

        expect(result).toHaveProperty('federal_liability');
        expect(result).toHaveProperty('state_liability');
        expect(result).toHaveProperty('effective_rate');
        expect(result).toHaveProperty('marginal_rate');
        expect(result).toHaveProperty('quarterly_estimate');
      });
  });

  it('generates pact for POST /v1/scenario comparison endpoint', async () => {
    const scenarioRequest = {
      baseline: {
        filing_status: 'single',
        income: 100000.0,
        deductions: 12000.0,
        state: 'CA',
      },
      scenarios: [
        {
          name: 'Increased Deductions',
          income: 100000.0,
          deductions: 20000.0,
          state: 'CA',
        },
        {
          name: 'Bonus Income',
          income: 150000.0,
          deductions: 12000.0,
          state: 'CA',
        },
      ],
    };

    const expectedScenarioResponse = {
      baseline: {
        federal_liability: MatchersV3.number(18000.0),
        state_liability: MatchersV3.number(6000.0),
        effective_rate: MatchersV3.number(0.24),
        marginal_rate: MatchersV3.number(0.24),
        quarterly_estimate: MatchersV3.number(6000.0),
      },
      scenarios: MatchersV3.eachLike({
        name: MatchersV3.string('Increased Deductions'),
        total_tax: MatchersV3.number(22000.0),
        delta_vs_baseline: MatchersV3.number(-2000.0),
      }),
    };

    await pact
      .addInteraction()
      .uponReceiving('a request for scenario tax comparison')
      .withRequest('POST', '/v1/scenario', (builder) => {
        builder.headers({
          Authorization: `Bearer ${sampleToken}`,
          'Content-Type': 'application/json',
        });
        builder.jsonBody(scenarioRequest);
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(expectedScenarioResponse);
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/v1/scenario`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sampleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(scenarioRequest),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toHaveProperty('baseline');
        expect(json).toHaveProperty('scenarios');
      });
  });
});
