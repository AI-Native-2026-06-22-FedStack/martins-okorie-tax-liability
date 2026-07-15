/**
 * rate-limit.test.ts
 *
 * Proves the per-tenant rate-limit contract:
 *
 *  1. RateLimit headers (IETF draft-8 combined form) are present on allowed
 *     responses and the remaining (r=) value decrements across requests.
 *  2. Exceeding the cap returns 429 with Retry-After and a Problem+JSON body
 *     matching the Module 2 error contract.
 *  3. The cost-accounting header (X-Request-Cost, X-Quota-Remaining) is present
 *     on a representative write endpoint.
 *  4. (Fail-open) Redis disconnection does not block traffic.
 *
 * The RATE_LIMIT_MAX environment variable is set to 3 for this test file so
 * the cap can be reached in a small number of requests without flushing a
 * production-sized window. The window key is flushed in beforeEach.
 */
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

import { signAccessToken } from "../src/auth/tokens.js";

// Tenant A and Tenant B have independent Redis keys — one must not throttle the other.
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

const tokenA = signAccessToken({ sub: "advisor-a@taxpulse.com", tenant_id: TENANT_A, role: "Advisor" });
const tokenB = signAccessToken({ sub: "advisor-b@taxpulse.com", tenant_id: TENANT_B, role: "Advisor" });

// Override the limit to 3 so we can exceed it quickly in tests.
// express-rate-limit reads this at module-load time, so we set it before importing.
process.env.RATE_LIMIT_MAX = "3";
process.env.RATE_LIMIT_WINDOW_MS = "60000";

let app: Express;
let redisClient: typeof import("../src/middleware/rate-limit.js").redisClient;

async function waitForRedisReady(): Promise<void> {
  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    if (redisClient.status === "ready") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Redis did not become ready for rate-limit tests; status=${redisClient.status}`);
}

function expectNoLegacyRateLimitHeaders(res: request.Response): void {
  expect(res.get("X-RateLimit-Limit")).toBeUndefined();
  expect(res.get("X-RateLimit-Remaining")).toBeUndefined();
  expect(res.get("X-RateLimit-Reset")).toBeUndefined();
}

describe("Rate Limit Contract", () => {
  beforeAll(async () => {
    ({ app } = await import("../src/app.js"));
    ({ redisClient } = await import("../src/middleware/rate-limit.js"));

    if (redisClient.status !== "ready") {
      await redisClient.connect().catch(() => {});
    }
    await waitForRedisReady();
  });

  beforeEach(async () => {
    // Start each test with a clean window so counts don't bleed between cases
    await redisClient.flushall().catch(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ taxable_income: 1000, tax_liability: 100 }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );
  });

  afterAll(async () => {
    await redisClient.flushall().catch(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Test 1: RateLimit headers present and r= decrements ───────────────────
  it("RateLimit and RateLimit-Policy headers are present; remaining (r=) decrements across requests", async () => {
    let prevRemaining: number | null = null;

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/cycles/decrement-${i}/compute`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ income: 1200, deductions: 200 });

      expect(res.status).toBe(200);

      // Standard IETF draft-8 combined header — NOT X-RateLimit-* legacy headers
      const rateLimitHeader = res.get("RateLimit");
      const rateLimitPolicy = res.get("RateLimit-Policy");
      expect(rateLimitHeader).toBeDefined();
      expect(rateLimitPolicy).toBeDefined();

      // Legacy X-RateLimit-* headers must NOT be present (legacyHeaders: false)
      expectNoLegacyRateLimitHeaders(res);

      // Parse the r= remaining field from the draft-8 header
      const match = /r=(\d+)/.exec(rateLimitHeader!);
      expect(match).not.toBeNull();
      const remaining = Number(match![1]);

      // Remaining must decrement with each successive request in the same window
      if (prevRemaining !== null) {
        expect(remaining).toBeLessThan(prevRemaining);
      }
      prevRemaining = remaining;
    }
  });

  // ─── Test 2: 429 carries Retry-After and Problem+JSON body ─────────────────
  it("exceeding the cap returns 429 with Retry-After and a Problem+JSON body", async () => {
    // Exhaust the cap (limit=3 set above)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/cycles/exhaust-${i}/compute`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ income: 1200, deductions: 200 });
    }

    // The 4th request must be rejected
    const res = await request(app)
      .post("/cycles/over-limit/compute")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ income: 1200, deductions: 200 });

    expect(res.status).toBe(429);

    // Retry-After header must be present
    const retryAfter = res.get("Retry-After");
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // Body must match the Module 2 Problem+JSON error contract
    expect(res.type).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: expect.stringContaining("Retry after")
    });
    // instance must be present (from the existing error contract)
    expect(res.body.instance).toBeDefined();

    // Legacy headers must still be absent even on rejection
    expectNoLegacyRateLimitHeaders(res);
  });

  // ─── Test 3: Cost-accounting headers present on write endpoint ──────────────
  it("X-Request-Cost and X-Quota-Remaining cost-accounting headers are present on a write endpoint", async () => {
    const res = await request(app)
      .post("/cycles/cost-header-check/compute")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ income: 1200, deductions: 200 });

    expect(res.status).toBe(200);

    // X-Request-Cost — reflects the operation type (compute = 4)
    const cost = res.get("X-Request-Cost");
    expect(cost).toBeDefined();
    expect(Number(cost)).toBe(4);

    // X-Quota-Remaining — derived from the RateLimit r= field; shows remaining budget
    const quotaRemaining = res.get("X-Quota-Remaining");
    expect(quotaRemaining).toBeDefined();
    expect(Number(quotaRemaining)).toBeGreaterThanOrEqual(0);
    expectNoLegacyRateLimitHeaders(res);
  });

  // ─── Stretch: cross-tenant isolation ───────────────────────────────────────
  it("one tenant's burst does not throttle another tenant", async () => {
    // Exhaust Tenant A's cap
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/cycles/a-burst-${i}/compute`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ income: 1200, deductions: 200 });
    }

    // Tenant A should now be at the limit
    const resA = await request(app)
      .post("/cycles/a-over-limit/compute")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ income: 1200, deductions: 200 });
    expect(resA.status).toBe(429);

    // Tenant B has an independent key and must still be allowed
    const resB = await request(app)
      .post("/cycles/b-not-throttled/compute")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ income: 1200, deductions: 200 });
    expect(resB.status).toBe(200);
  });

  // ─── Existing: fail-open on Redis disconnection ─────────────────────────────
  it("fails open gracefully if Redis is disconnected", async () => {
    await redisClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(redisClient.status).not.toBe("ready");

    const res = await request(app)
      .post("/cycles/fail-open-check/compute")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ income: 1200, deductions: 200 });

    expect(res.status).toBe(200);

    await redisClient.connect().catch(() => {});
  });
});
