import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { signAccessToken, getPublicKey } from "../../src/auth/tokens.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ROLE = "Firm Admin";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

describe("Token Signing & Public Key Verification", () => {
  it("signs a token with user/tenant/role and verifies signature using the public key", () => {
    const payload = { sub: USER_ID, tenant_id: TENANT_ID, role: ROLE };
    const token = signAccessToken(payload);

    // Verify token decoded claims
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: ["RS256"],
      issuer: "taxpulse-api",
      audience: "taxpulse-clients"
    }) as any;

    expect(decoded.sub).toBe(USER_ID);
    expect(decoded.tenant_id).toBe(TENANT_ID);
    expect(decoded.role).toBe(ROLE);
    expect(decoded.iss).toBe("taxpulse-api");
    expect(decoded.aud).toBe("taxpulse-clients");

    // Verify kid is in header
    const decodedHeader = jwt.decode(token, { complete: true }) as any;
    expect(decodedHeader.header.kid).toBe("2026-07");
    expect(decodedHeader.header.alg).toBe("RS256");
  });
});

describeWithDatabase("Protected Write Route (POST /cycles) - Integration", () => {
  it("allows access with a valid signed token", async () => {
    const payload = { sub: USER_ID, tenant_id: TENANT_ID, role: ROLE };
    const token = signAccessToken(payload);

    const res = await request(app)
      .post("/cycles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: "client-001",
        due_date: "2026-08-31",
        owner: "Fictional Advisor",
        planning_period: "2026 Q3",
        priority: "P2"
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});

describe("Protected Write Route (POST /cycles) - Authentication Verification", () => {
  it("returns 401 for a request without a token", async () => {
    const res = await request(app)
      .post("/cycles")
      .send({
        client_id: "client-001",
        due_date: "2026-08-31",
        owner: "Fictional Advisor",
        planning_period: "2026 Q3",
        priority: "P2"
      });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBeDefined();
  });

  it("returns 401 for a request with an invalid/tampered token", async () => {
    const res = await request(app)
      .post("/cycles")
      .set("Authorization", `Bearer invalid-token-string`)
      .send({
        client_id: "client-001",
        due_date: "2026-08-31",
        owner: "Fictional Advisor",
        planning_period: "2026 Q3",
        priority: "P2"
      });

    expect(res.status).toBe(401);
  });
});
