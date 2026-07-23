import type { NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import slowDown from "express-slow-down";
import { RedisStore, type RedisReply } from "rate-limit-redis";

import { ensureRedisReady, redisClient } from "../store/queueCache.js";
import { sendProblem } from "../errors/problem-json.js";
import { setQuotaRemainingHeader } from "./cost-header.js";

export { redisClient };

// Tunable limits loaded from env/config per environment
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const limit = Number(process.env.RATE_LIMIT_MAX || 100);

// Graduated slow-down threshold and delay calculation:
// Threshold starts after 50% of the limit (e.g. 50 requests).
// Each request past threshold adds 200ms latency to introduce back-pressure.
const slowDownThreshold = Math.floor(limit * 0.5);
const slowDownDelayFactor = 200;

// 1. Shared rate limit store utilizing Redis
// prefix "rl:" differentiates from the slow-down store ("sd:") to avoid ERR_ERL_DOUBLE_COUNT
const limiterStore = new RedisStore({
  prefix: "rl:",
  sendCommand: async (...args: string[]) => {
    await ensureRedisReady();
    const [command, ...commandArgs] = args;
    if (!command) {
      throw new Error("Redis command is required");
    }
    return redisClient.call(command, ...commandArgs) as Promise<RedisReply>;
  }
});

// 2. Fixed-window rate limiter
// Enforces standard RateLimit headers (draft-8) and keys limits per authenticated tenant_id claim.
const rawLimiter = rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: limiterStore,
  keyGenerator: (req: Request) => {
    // Key by tenant_id claim derived from verified JWT verifier (req.user.tenant_id)
    return req.user?.tenant_id ?? req.get("x-tenant-id") ?? ipKeyGenerator(req.ip ?? "");
  },
  handler: (req: Request, res: Response) => {
    // Retry-After is already set by express-rate-limit before this handler is called.
    const retryAfter = String(res.getHeader("Retry-After") ?? 60);
    setQuotaRemainingHeader(res);
    sendProblem(res, {
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: `Per-tenant rate limit exceeded. Retry after ${retryAfter} seconds.`,
      instance: req.originalUrl
    });
  }
});

// 3. Slow-down store with a distinct prefix to avoid double-counting with the limiter
const slowDownStore = new RedisStore({
  prefix: "sd:",
  sendCommand: async (...args: string[]) => {
    await ensureRedisReady();
    const [command, ...commandArgs] = args;
    if (!command) {
      throw new Error("Redis command is required");
    }
    return redisClient.call(command, ...commandArgs) as Promise<RedisReply>;
  }
});

// 4. Graduated slow-down middleware
const rawSlowDown = slowDown({
  windowMs,
  delayAfter: slowDownThreshold,
  delayMs: (used: number) => {
    // express-slow-down v2 expects delayMs to return number of milliseconds
    const excess = used - slowDownThreshold;
    return excess * slowDownDelayFactor;
  },
  store: slowDownStore,
  keyGenerator: (req: Request) => {
    return req.user?.tenant_id ?? req.get("x-tenant-id") ?? ipKeyGenerator(req.ip ?? "");
  }
});

/**
 * Tenant-keyed rate limiter middleware wrapper.
 * Fails open if Redis is down or unreachable to preserve SaaS application availability.
 */
export function tenantRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (redisClient.status !== "ready") {
    req.log.warn("Redis is unreachable. Bypassing rate limiter (fail-open).");
    return next();
  }

  rawLimiter(req, res, (err: unknown) => {
    if (err) {
      req.log.error({ err }, "Rate limiter store failed. Bypassing limit (fail-open).");
      return next();
    }
    setQuotaRemainingHeader(res);
    next();
  });
}

/**
 * Tenant-keyed graduated slow-down middleware wrapper.
 * Fails open if Redis is down or unreachable to prevent unnecessary latency spikes.
 */
export function tenantSlowDown(req: Request, res: Response, next: NextFunction): void {
  if (redisClient.status !== "ready") {
    req.log.warn("Redis is unreachable. Bypassing slow-down (fail-open).");
    return next();
  }

  rawSlowDown(req, res, (err: unknown) => {
    if (err) {
      req.log.error({ err }, "Slow-down store failed. Bypassing slow-down (fail-open).");
      return next();
    }
    next();
  });
}
