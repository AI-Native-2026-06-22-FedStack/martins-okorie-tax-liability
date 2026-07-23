import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { resetApiEnvForTests } from "../../src/config/env.js";
import {
  ensureRedisReady,
  redisClient,
  releaseRedisLock
} from "../../src/store/queueCache.js";
import {
  invalidatePlanCycleQueueCacheForTenant,
  listCachedPlanCycleQueue
} from "../../src/store/queueCache.js";
import {
  setPlanCycleQueueProjectorForTests,
  type PlanCycleQueueProjector,
  type PlanCycleQueueReadModel,
  type PlanCycleQueueReadQuery
} from "../../src/store/dynamo.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const QUEUE_CACHE_KEY = `queue:${TENANT_ID}:Intake:Fictional Advisor:50`;

const queueRows: PlanCycleQueueReadModel[] = [
  {
    GSI1PK: `TENANT#${TENANT_ID}#OWNER#Fictional Advisor#STAGE#Intake`,
    GSI1SK: "DUE#2026-08-31#PRIORITY#P1#CYCLE#cycle-001",
    PK: `TENANT#${TENANT_ID}`,
    SK: "QUEUE#STAGE#Intake#DUE#2026-08-31#PRIORITY#P1#CYCLE#cycle-001",
    client_id: "client-fictional-cache",
    due_date: "2026-08-31",
    hold_reason: null,
    id: "cycle-001",
    on_hold: false,
    overdue: false,
    owner: "Fictional Advisor",
    planning_period: "2026 Q3",
    priority: "P1",
    stage: "Intake",
    tenant_id: TENANT_ID
  }
];

class CountingProjector implements PlanCycleQueueProjector {
  listCalls = 0;
  rows = queueRows;

  async deleteCycle(): Promise<void> {}

  async getCycleById(): Promise<PlanCycleQueueReadModel | null> {
    return null;
  }

  async listOverdueByDueDate(): Promise<PlanCycleQueueReadModel[]> {
    return [];
  }

  async listQueue(_query: PlanCycleQueueReadQuery): Promise<PlanCycleQueueReadModel[]> {
    this.listCalls += 1;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
    return this.rows;
  }

  async upsertCycle(): Promise<void> {}
}

describe("Plan Cycle Queue cache-aside", () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      AWS_ENDPOINT: "http://localhost:8000",
      AWS_REGION: "us-east-1",
      DB_HOST: "localhost",
      DB_NAME: "taxpulse",
      DB_PORT: "5432",
      DB_SECRET_ID: "taxpulse/db-password",
      DB_SSL: "disable",
      DB_USER: "taxpulse_app",
      DDB_ENDPOINT: "http://localhost:8000",
      DDB_TABLE_NAME: "taxpulse-plan-cycle-read-model-test",
      JWT_SECRET_ID: "taxpulse/jwt-signing-keys",
      PORT: "3000"
    });
    resetApiEnvForTests();
    await ensureRedisReady();
    await redisClient.flushdb();
    setPlanCycleQueueProjectorForTests(undefined);
  });

  afterAll(async () => {
    setPlanCycleQueueProjectorForTests(undefined);
  });

  it("caches queue reads with a TTL and returns the second read without DynamoDB", async () => {
    const projector = new CountingProjector();
    setPlanCycleQueueProjectorForTests(projector);
    const query = {
      limit: 50,
      owner: "Fictional Advisor",
      stage: "Intake",
      tenant_id: TENANT_ID
    };

    const first = await listCachedPlanCycleQueue(query);
    const ttl = await redisClient.ttl(QUEUE_CACHE_KEY);
    const second = await listCachedPlanCycleQueue(query);

    expect(first).toEqual(queueRows);
    expect(second).toEqual(queueRows);
    expect(projector.listCalls).toBe(1);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("protects an expired hot cache key from stampede rebuilds", async () => {
    const projector = new CountingProjector();
    setPlanCycleQueueProjectorForTests(projector);
    const query = {
      limit: 50,
      owner: "Fictional Advisor",
      stage: "Intake",
      tenant_id: TENANT_ID
    };

    await listCachedPlanCycleQueue(query);
    expect(projector.listCalls).toBe(1);
    await redisClient.del(QUEUE_CACHE_KEY);

    const [first, second, third] = await Promise.all([
      listCachedPlanCycleQueue(query),
      listCachedPlanCycleQueue(query),
      listCachedPlanCycleQueue(query)
    ]);

    expect(first).toEqual(queueRows);
    expect(second).toEqual(queueRows);
    expect(third).toEqual(queueRows);
    expect(projector.listCalls).toBe(2);
  });

  it("invalidates stale queue data so the next read is rebuilt fresh", async () => {
    const projector = new CountingProjector();
    setPlanCycleQueueProjectorForTests(projector);
    const query = {
      limit: 50,
      stage: "Intake",
      tenant_id: TENANT_ID
    };

    const first = await listCachedPlanCycleQueue(query);
    projector.rows = [
      {
        ...queueRows[0],
        GSI1PK: `TENANT#${TENANT_ID}#OWNER#Fictional Advisor#STAGE#Review`,
        GSI1SK: "DUE#2026-09-15#PRIORITY#P1#CYCLE#cycle-001",
        SK: "QUEUE#STAGE#Review#DUE#2026-09-15#PRIORITY#P1#CYCLE#cycle-001",
        due_date: "2026-09-15",
        stage: "Review"
      }
    ];
    await invalidatePlanCycleQueueCacheForTenant(TENANT_ID);
    const rebuilt = await listCachedPlanCycleQueue(query);

    expect(first[0]?.stage).toBe("Intake");
    expect(rebuilt[0]?.stage).toBe("Review");
    expect(rebuilt[0]?.due_date).toBe("2026-09-15");
    expect(projector.listCalls).toBe(2);
  });

  it("does not delete a newer request's lock when an expired lock owner releases", async () => {
    const lockKey = "queue-lock:test";
    const originalOwner = "owner-request-1";
    const newOwner = "owner-request-2";

    await redisClient.set(lockKey, originalOwner, "PX", 5000);

    // Simulate lock expiration and re-acquisition by request 2
    await redisClient.set(lockKey, newOwner, "PX", 5000);

    // Request 1 attempts release after its lock expired
    const released = await releaseRedisLock(lockKey, originalOwner);

    expect(released).toBe(false);
    expect(await redisClient.get(lockKey)).toBe(newOwner);
  });
});
