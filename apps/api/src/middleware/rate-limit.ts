import type { NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import slowDown from "express-slow-down";
import Redis from "ioredis";
import { RedisStore } from "rate-limit-redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Initialize Redis client with offline queue disabled/handling to prevent hung connections
export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: () => null // do not auto-reconnect; the app reconnects on next startup
});

redisClient.on("error", (err) => {
  // Silent fail-open log warning on socket error
  console.warn("Redis connection error, rate limiting will fail-open:", err.message);
});

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
    // If Redis is not connected, fail-open immediately
    if (redisClient.status !== "ready") {
      throw new Error("Redis client is not ready");
    }
    return redisClient.call(args[0], ...args.slice(1));
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
    return req.user?.tenant_id ?? req.get("x-tenant-id") ?? ipKeyGenerator(req);
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = res.getHeader("Retry-After");
    res.status(429).json({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: `Rate limit exceeded. Retry after ${retryAfter || 60} seconds.`
    });
  }
});

// 3. Slow-down store with a distinct prefix to avoid double-counting with the limiter
const slowDownStore = new RedisStore({
  prefix: "sd:",
  sendCommand: async (...args: string[]) => {
    if (redisClient.status !== "ready") {
      throw new Error("Redis client is not ready");
    }
    return redisClient.call(args[0], ...args.slice(1));
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
    return req.user?.tenant_id ?? req.get("x-tenant-id") ?? ipKeyGenerator(req);
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

  rawLimiter(req, res, (err) => {
    if (err) {
      req.log.error({ err }, "Rate limiter store failed. Bypassing limit (fail-open).");
      return next();
    }
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

  rawSlowDown(req, res, (err) => {
    if (err) {
      req.log.error({ err }, "Slow-down store failed. Bypassing slow-down (fail-open).");
      return next();
    }
    next();
  });
}
