import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("Express Correlation ID Middleware", () => {
  it("generates a fresh UUID correlation ID when header is missing", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-correlation-id"]).toBeDefined();
    // Verify it is a valid UUID format (8-4-4-4-12 hex chars)
    expect(res.headers["x-correlation-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("reuses the correlation ID header sent in request", async () => {
    const customId = "my-custom-correlation-id-999";
    const res = await request(app)
      .get("/health")
      .set("x-correlation-id", customId);

    expect(res.status).toBe(200);
    expect(res.headers["x-correlation-id"]).toBe(customId);
  });

  it("reuses x-request-id as correlation ID if x-correlation-id is absent", async () => {
    const customReqId = "my-custom-request-id-111";
    const res = await request(app)
      .get("/health")
      .set("x-request-id", customReqId);

    expect(res.status).toBe(200);
    expect(res.headers["x-correlation-id"]).toBe(customReqId);
  });
});
