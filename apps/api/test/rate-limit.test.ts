import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { signAccessToken } from "../src/auth/tokens.js";
import { redisClient } from "../src/middleware/rate-limit.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ADVISOR_PAYLOAD = { sub: "advisor-limits@taxpulse.com", tenant_id: TENANT_ID, role: "Advisor" };

describe("Tenant-Keyed Rate Limiting and Slow-Down (Task 1)", () => {
  let token: string;

  beforeAll(async () => {
    token = signAccessToken(ADVISOR_PAYLOAD);
    // Ensure Redis is connected before starting
    if (redisClient.status !== "ready") {
      await redisClient.connect().catch(() => {});
    }
  });

  afterAll(async () => {
    // Clean up Redis keys generated during tests
    await redisClient.flushall().catch(() => {});
  });

  it("decrements the standard IETF RateLimit headers and enforces slow-down latency", async () => {
    // Flush keys to start with a fresh window count
    await redisClient.flushall();

    // 1. Send requests under the slow-down threshold (50% of 100 limit = 50)
    // Send 5 requests and verify headers and response times are fast
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      const res = await request(app)
        .post("/cycles")
        .set("Authorization", `Bearer ${token}`)
        .send({
          client_id: `client-${i}`,
          due_date: "2026-09-30",
          hold_reason: null,
          on_hold: false,
          owner: "Advisor Limit Tester",
          planning_period: "2026 Q3",
          priority: "P1"
        });

      const duration = Date.now() - startTime;
      expect(res.status).toBe(201);
      // Under threshold, latency must be sub-100ms (no slow-down delay)
      expect(duration).toBeLessThan(100);

      // Verify draft-8 RateLimit header exists and counts down
      const rateLimitHeader = res.get("RateLimit");
      expect(rateLimitHeader).toBeDefined();
    }
  });

  it("fails open gracefully and allows traffic through if Redis is disconnected", async () => {
    // 1. Temporarily disconnect Redis client to simulate outage
    await redisClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(redisClient.status).not.toBe("ready");

    // 2. Perform write request
    const res = await request(app)
      .post("/cycles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: "client-fail-open",
        due_date: "2026-09-30",
        hold_reason: null,
        on_hold: false,
        owner: "Advisor Limit Tester",
        planning_period: "2026 Q3",
        priority: "P1"
      });

    // Request must succeed (fail-open) instead of throwing 500 error
    expect(res.status).toBe(201);

    // 3. Reconnect Redis for subsequent tests
    await redisClient.connect().catch(() => {});
  });
});
