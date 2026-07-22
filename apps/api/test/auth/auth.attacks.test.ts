import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/hashing.js";
import { encryptSecret } from "../../src/auth/mfa.js";
import { getPublicKey, signAccessToken } from "../../src/auth/tokens.js";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/client.js";
import { credential, mfaEnrollment, role, tenant, user } from "../../src/db/schema.js";
import { generate } from "otplib/functional";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

const TEST_TENANT_ID = "33333333-3333-4333-8333-333333333333";
const TEST_USER_ID = "44444444-4444-4444-8444-444444444444";
const TEST_ROLE_ID = "55555555-5555-4555-8555-555555555555";
const TEST_EMAIL = "advisor-attacks@taxpulse.com";
const TEST_PASSWORD = "correct-password-attacks";
const TEST_TOTP_SECRET = "US6XJ552V3R4T75WUS6XJ552V3R4T75W"; // 32 character base32 secret (20 bytes)

let testSecretCounter = 0;
let currentTotpSecret = TEST_TOTP_SECRET;

describe("Authentication Attacks - Independent Regressions", () => {
  it("rejects an alg=none forged token", async () => {
    // Forge an alg=none token with elevated roles
    const payload = {
      sub: "attacker",
      tenant_id: TEST_TENANT_ID,
      role: "Firm Admin",
      iss: "taxpulse-api",
      aud: "taxpulse-clients"
    };

    // Encode without signing (alg=none)
    const header = { alg: "none", typ: "JWT" };
    const forgedToken = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.`;

    const res = await request(app)
      .post("/cycles")
      .set("Authorization", `Bearer ${forgedToken}`)
      .send({
        client_id: "client-001",
        due_date: "2026-08-31",
        owner: "Fictional Advisor",
        planning_period: "2026 Q3",
        priority: "P2"
      });

    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong key", async () => {
    // Generate a different RSA keypair
    const differentKeys = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });

    const payload = {
      sub: "attacker",
      tenant_id: TEST_TENANT_ID,
      role: "Firm Admin",
      iss: "taxpulse-api",
      aud: "taxpulse-clients"
    };

    const wrongSignedToken = jwt.sign(payload, differentKeys.privateKey, {
      algorithm: "RS256",
      keyid: "2026-07"
    });

    const res = await request(app)
      .post("/cycles")
      .set("Authorization", `Bearer ${wrongSignedToken}`)
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

describeWithDatabase("Authentication & MFA Challenge Flow - Database Dependent", () => {
  beforeAll(async () => {
    const db = getDb();

    // 1. Seed Tenant
    await db.insert(tenant).values({
      id: TEST_TENANT_ID,
      name: "Attacks Test Tenant"
    });

    // 2. Seed Role
    await db.insert(role).values({
      id: TEST_ROLE_ID,
      tenant_id: TEST_TENANT_ID,
      name: "Advisor"
    });

    // 3. Seed User
    await db.insert(user).values({
      id: TEST_USER_ID,
      tenant_id: TEST_TENANT_ID,
      email: TEST_EMAIL,
      status: "active",
      role_id: TEST_ROLE_ID
    });

    // 4. Seed Credential
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await db.insert(credential).values({
      tenant_id: TEST_TENANT_ID,
      user_id: TEST_USER_ID,
      password_hash: passwordHash
    });

    // 5. Seed MFA Enrollment
    const encryptedSecret = encryptSecret(TEST_TOTP_SECRET);
    await db.insert(mfaEnrollment).values({
      tenant_id: TEST_TENANT_ID,
      user_id: TEST_USER_ID,
      totp_secret: encryptedSecret,
      enrolled: true
    });
  });

  beforeEach(async () => {
    const db = getDb();
    currentTotpSecret = "US6XJ552V3R4T75WUS6XJ552V3R4T75" + (testSecretCounter++ % 6 + 2);
    const updatedEncryptedSecret = encryptSecret(currentTotpSecret);
    await db
      .update(mfaEnrollment)
      .set({ totp_secret: updatedEncryptedSecret })
      .where(eq(mfaEnrollment.user_id, TEST_USER_ID));
  });

  afterAll(async () => {
    const db = getDb();
    // Clean up seeded records in reverse order
    await db.execute(
      `TRUNCATE refresh_token, mfa_enrollment, credential, "user", role, tenant RESTART IDENTITY CASCADE`
    );
  });

  it("rejects login request for unknown user", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: "unknown@taxpulse.com",
        password: "some-password"
      });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Invalid credentials.");
  });

  it("rejects login request for wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: TEST_EMAIL,
        password: "wrong-password"
      });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Invalid credentials.");
  });

  it("accepts login and returns temp token to advance to MFA", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.tempToken).toBeDefined();
  });

  it("rejects MFA challenge with wrong TOTP code", async () => {
    // 1. Get temp token
    const loginRes = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    const tempToken = loginRes.body.tempToken;

    // 2. Submit wrong TOTP
    const res = await request(app)
      .post("/auth/mfa")
      .send({
        tempToken,
        code: "000000"
      });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Invalid credentials.");
  });

  it("rejects MFA challenge with replayed TOTP code", async () => {
    // 1. Get temp token
    const loginRes = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    const tempToken1 = loginRes.body.tempToken;

    // Generate valid TOTP token
    const code = await generate({ secret: currentTotpSecret });

    // 2. Submit first time (valid)
    const mfaRes1 = await request(app)
      .post("/auth/mfa")
      .send({
        tempToken: tempToken1,
        code
      });
    expect(mfaRes1.status).toBe(200);

    // 3. Submit second time (replay)
    const loginRes2 = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    const tempToken2 = loginRes2.body.tempToken;

    const mfaRes2 = await request(app)
      .post("/auth/mfa")
      .send({
        tempToken: tempToken2,
        code
      });
    expect(mfaRes2.status).toBe(401);
    expect(mfaRes2.body.detail).toBe("Invalid credentials.");
  });

  it("completes full login + MFA flow successfully and allows access to protected route", async () => {
    // 1. Login
    const loginRes = await request(app)
      .post("/auth/login")
      .set("x-tenant-id", TEST_TENANT_ID)
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    const tempToken = loginRes.body.tempToken;

    // Generate a fresh TOTP code
    const code = await generate({ secret: currentTotpSecret });

    // 2. Verify MFA
    const mfaRes = await request(app)
      .post("/auth/mfa")
      .send({
        tempToken,
        code
      });

    expect(mfaRes.status).toBe(200);
    expect(mfaRes.body.accessToken).toBeDefined();
    expect(mfaRes.body.refreshToken).toBeDefined();

    // 3. Access guarded route
    const cycleRes = await request(app)
      .post("/cycles")
      .set("Authorization", `Bearer ${mfaRes.body.accessToken}`)
      .send({
        client_id: "client-att-001",
        due_date: "2026-08-31",
        owner: "Fictional Advisor",
        planning_period: "2026 Q3",
        priority: "P2"
      });

    expect(cycleRes.status).toBe(201);
    expect(cycleRes.body.id).toBeDefined();
  });
});
