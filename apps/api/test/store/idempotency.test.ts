import { count, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { signAccessToken } from "../../src/auth/tokens.js";
import { ensureRedisReady, redisClient } from "../../src/store/queueCache.js";
import { closeDefaultDb, createDrizzleDb, type TaxPulseDb } from "../../src/db/client.js";
import { taxPlanCycle } from "../../src/db/schema.js";
import {
  setPlanCycleQueueProjectorForTests,
  type PlanCycleQueueProjector
} from "../../src/store/dynamo.js";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

let db: TaxPulseDb;
let pool: ReturnType<typeof createDrizzleDb>["pool"];

const projector: PlanCycleQueueProjector = {
  async deleteCycle() {},
  async getCycleById() {
    return null;
  },
  async listOverdueByDueDate() {
    return [];
  },
  async listQueue() {
    return [];
  },
  async upsertCycle() {}
};

function createBody(clientId: string) {
  return {
    client_id: clientId,
    due_date: "2026-09-30",
    hold_reason: null,
    on_hold: false,
    owner: "Fictional Advisor",
    planning_period: "2026 Q3",
    priority: "P1"
  };
}

async function countCyclesForTenant(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(taxPlanCycle)
    .where(eq(taxPlanCycle.tenant_id, tenantId));

  return row?.value ?? 0;
}

describeWithDatabase("Idempotency-Key create protection", () => {
  beforeAll(() => {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error("TAXPULSE_TEST_DATABASE_URL is required for idempotency tests.");
    }

    const connection = createDrizzleDb(connectionString);
    db = connection.db;
    pool = connection.pool;
  });

  beforeEach(async () => {
    await ensureRedisReady();
    await redisClient.flushdb();
    setPlanCycleQueueProjectorForTests(projector);
  });

  afterAll(async () => {
    setPlanCycleQueueProjectorForTests(undefined);
    await closeDefaultDb();
    await pool.end();
  });

  it("replays three sequential creates with identical responses and one database row", async () => {
    const token = signAccessToken({
      sub: "advisor-idem-a",
      tenant_id: TENANT_A_ID,
      role: "Advisor"
    });
    const body = createBody("client-fictional-idem-sequential");

    const first = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-sequential")
      .send(body)
      .expect(201);
    const second = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-sequential")
      .send(body)
      .expect(201);
    const third = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-sequential")
      .send(body)
      .expect(201);

    expect(second.body).toEqual(first.body);
    expect(third.body).toEqual(first.body);
    expect(await countCyclesForTenant(TENANT_A_ID)).toBe(1);
  });

  it("serializes concurrent duplicate creates and replays the first response", async () => {
    const token = signAccessToken({
      sub: "advisor-idem-b",
      tenant_id: TENANT_A_ID,
      role: "Advisor"
    });
    const body = createBody("client-fictional-idem-concurrent");
    const lockKey = `lock:${TENANT_A_ID}:idem-concurrent`;

    const [first, second] = await Promise.all([
      request(app)
        .post("/v1/cycles")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "idem-concurrent")
        .send(body),
      request(app)
        .post("/v1/cycles")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "idem-concurrent")
        .send(body)
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(await countCyclesForTenant(TENANT_A_ID)).toBe(1);
    expect(await redisClient.exists(lockKey)).toBe(0);

    const retry = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-concurrent")
      .send(body)
      .expect(201);

    expect(retry.body).toEqual(first.body);
    expect(await countCyclesForTenant(TENANT_A_ID)).toBe(1);
  });

  it("allows distinct idempotency keys to create distinct cycles for one tenant", async () => {
    const token = signAccessToken({
      sub: "advisor-idem-distinct",
      tenant_id: TENANT_A_ID,
      role: "Advisor"
    });

    const first = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-distinct-a")
      .send(createBody("client-fictional-distinct-a"))
      .expect(201);
    const second = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-distinct-b")
      .send(createBody("client-fictional-distinct-b"))
      .expect(201);

    expect(second.body.id).not.toBe(first.body.id);
    expect(await countCyclesForTenant(TENANT_A_ID)).toBe(2);
  });

  it("scopes an identical idempotency key to the verified tenant claim", async () => {
    const tokenA = signAccessToken({ sub: "advisor-a", tenant_id: TENANT_A_ID, role: "Advisor" });
    const tokenB = signAccessToken({ sub: "advisor-b", tenant_id: TENANT_B_ID, role: "Advisor" });

    const first = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", "tenant-scoped")
      .send(createBody("client-fictional-tenant-a"))
      .expect(201);
    const second = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("Idempotency-Key", "tenant-scoped")
      .send(createBody("client-fictional-tenant-b"))
      .expect(201);

    expect(second.body.id).not.toBe(first.body.id);
    expect(await countCyclesForTenant(TENANT_A_ID)).toBe(1);
    expect(await countCyclesForTenant(TENANT_B_ID)).toBe(1);
  });
});
