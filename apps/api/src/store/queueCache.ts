import { Redis } from "ioredis";

import { getApiEnv } from "../config/env.js";
import {
  getPlanCycleQueueProjector,
  type PlanCycleQueueReadModel,
  type PlanCycleQueueReadQuery
} from "./dynamo.js";

const CACHE_PREFIX = "queue";
const LOCK_PREFIX = "queue-lock";
const LOCK_TTL_MS = 5_000;
const WAIT_ATTEMPTS = 10;
const WAIT_MS = 50;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = new Redis(redisUrl, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null
});

redisClient.on("error", (err: Error) => {
  console.warn("Redis connection error:", err.message);
});

export async function ensureRedisReady(): Promise<void> {
  if (redisClient.status === "ready") {
    return;
  }

  if (redisClient.status === "wait" || redisClient.status === "end") {
    await redisClient.connect();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Redis did not become ready; status=${redisClient.status}`));
    }, 5_000);
    const cleanup = () => {
      clearTimeout(timeout);
      redisClient.off("ready", onReady);
      redisClient.off("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    redisClient.once("ready", onReady);
    redisClient.once("error", onError);
  });
}

export async function getRedisJson<T>(key: string): Promise<T | null> {
  await ensureRedisReady();
  const value = await redisClient.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setRedisJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await ensureRedisReady();
  await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

function queueCacheKey(query: PlanCycleQueueReadQuery): string {
  return [
    CACHE_PREFIX,
    query.tenant_id,
    query.stage,
    query.owner ?? "all",
    String(query.limit ?? 50)
  ].join(":");
}

function queueLockKey(cacheKey: string): string {
  return `${LOCK_PREFIX}:${cacheKey}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForCachedQueue(key: string): Promise<PlanCycleQueueReadModel[] | null> {
  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    await sleep(WAIT_MS);
    const cached = await getRedisJson<PlanCycleQueueReadModel[]>(key);
    if (cached) {
      return cached;
    }
  }

  return null;
}

export async function listCachedPlanCycleQueue(
  query: PlanCycleQueueReadQuery
): Promise<PlanCycleQueueReadModel[]> {
  const key = queueCacheKey(query);
  const cached = await getRedisJson<PlanCycleQueueReadModel[]>(key);
  if (cached) {
    return cached;
  }

  await ensureRedisReady();
  const lockKey = queueLockKey(key);
  const lockAcquired = await redisClient.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX");

  if (!lockAcquired) {
    const rebuilt = await waitForCachedQueue(key);
    if (rebuilt) {
      return rebuilt;
    }
  }

  try {
    const rows = await getPlanCycleQueueProjector().listQueue(query);
    await setRedisJson(key, rows, getApiEnv().QUEUE_CACHE_TTL_SECONDS);
    return rows;
  } finally {
    if (lockAcquired) {
      await redisClient.del(lockKey);
    }
  }
}

export async function invalidatePlanCycleQueueCacheForTenant(tenantId: string): Promise<void> {
  await ensureRedisReady();
  const stream = redisClient.scanStream({
    match: `${CACHE_PREFIX}:${tenantId}:*`
  });
  const keysToDelete: string[] = [];

  for await (const keys of stream) {
    keysToDelete.push(...(keys as string[]));
  }

  if (keysToDelete.length > 0) {
    await redisClient.del(...keysToDelete);
  }
}
