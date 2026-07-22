import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { getApiEnv } from "../config/env.js";
import { ensureRedisReady, getRedisJson, redisClient, setRedisJson } from "./queueCache.js";

interface StoredIdempotencyResponse {
  body: unknown;
  status: number;
}

const IDEMPOTENCY_WAIT_POLL_MS = 50;

function idempotencyKeyForTenant(tenantId: string, key: string): string {
  return `idem:${tenantId}:${key}`;
}

function idempotencyLockKeyForTenant(tenantId: string, key: string): string {
  return `lock:${tenantId}:${key}`;
}

function replayStoredResponse(res: Response, stored: StoredIdempotencyResponse): void {
  res.status(stored.status).json(stored.body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireIdempotencyLock(lockKey: string, owner: string): Promise<boolean> {
  const acquired = await redisClient.set(
    lockKey,
    owner,
    "PX",
    getApiEnv().IDEMPOTENCY_LOCK_TTL_MS,
    "NX"
  );

  return acquired === "OK";
}

async function releaseIdempotencyLock(lockKey: string, owner: string): Promise<void> {
  const currentOwner = await redisClient.get(lockKey);

  if (currentOwner === owner) {
    await redisClient.del(lockKey);
  }
}

async function waitForStoredResponse(
  resultKey: string,
  lockKey: string,
  owner: string
): Promise<StoredIdempotencyResponse | "lock-acquired" | null> {
  const timeoutAt = Date.now() + getApiEnv().IDEMPOTENCY_LOCK_TTL_MS;

  while (Date.now() < timeoutAt) {
    const stored = await getRedisJson<StoredIdempotencyResponse>(resultKey);

    if (stored) {
      return stored;
    }

    const lockExists = await redisClient.exists(lockKey);

    if (!lockExists && (await acquireIdempotencyLock(lockKey, owner))) {
      return "lock-acquired";
    }

    await sleep(IDEMPOTENCY_WAIT_POLL_MS);
  }

  return null;
}

export async function idempotencyKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey) {
    next();
    return;
  }

  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(401).json({
      detail: "Authentication is required before using Idempotency-Key.",
      status: 401,
      title: "Unauthorized",
      type: "about:blank"
    });
    return;
  }

  await ensureRedisReady();
  const resultKey = idempotencyKeyForTenant(tenantId, idempotencyKey);
  const lockKey = idempotencyLockKeyForTenant(tenantId, idempotencyKey);
  const stored = await getRedisJson<StoredIdempotencyResponse>(resultKey);

  if (stored) {
    replayStoredResponse(res, stored);
    return;
  }

  const lockOwner = randomUUID();
  const lockAcquired = await acquireIdempotencyLock(lockKey, lockOwner);

  if (!lockAcquired) {
    const waited = await waitForStoredResponse(resultKey, lockKey, lockOwner);

    if (waited && waited !== "lock-acquired") {
      replayStoredResponse(res, waited);
      return;
    }

    if (waited !== "lock-acquired") {
      res.status(409).json({
        detail: "A request with this Idempotency-Key is already in progress.",
        status: 409,
        title: "Request in progress",
        type: "about:blank"
      });
      return;
    }
  }

  const originalJson = res.json.bind(res);
  let responseBody: unknown;

  res.json = (body: unknown): Response => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    void (async () => {
      try {
        if (res.statusCode < 500) {
          await setRedisJson(
            resultKey,
            {
              body: responseBody,
              status: res.statusCode
            },
            getApiEnv().IDEMPOTENCY_TTL_SECONDS
          );
        }
      } finally {
        await releaseIdempotencyLock(lockKey, lockOwner);
      }
    })();
  });

  next();
}
