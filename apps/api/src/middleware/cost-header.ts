import type { NextFunction, Request, Response } from "express";

/**
 * cost-header.ts — Quota and cost-accounting response middleware.
 *
 * Emits two advisory headers on every response so consumers can track
 * per-request cost and remaining quota without a separate quota API call.
 * Enforcement is the job of the rate limiter — these headers are informational.
 *
 *   X-Request-Cost      — cost units charged for this specific operation.
 *                         Reflects the operation type (write > read, transition highest).
 *                         Configurable via COST_WRITE / COST_TRANSITION /
 *                         COST_COMPUTE / COST_READ env vars.
 *
 *   X-Quota-Remaining   — requests remaining in the tenant's current window,
 *                         read from the IETF draft-8 `RateLimit` header's r= field
 *                         (set by express-rate-limit before this middleware writes headers).
 *
 * Header spec citation: IETF draft-ietf-httpapi-ratelimit-headers (not RFC 9239,
 * which defines JavaScript media types and has nothing to do with rate limiting).
 */

const COST_WRITE = Number(process.env.COST_WRITE ?? 2);
const COST_TRANSITION = Number(process.env.COST_TRANSITION ?? 3);
const COST_COMPUTE = Number(process.env.COST_COMPUTE ?? 4);
const COST_READ = Number(process.env.COST_READ ?? 1);

function routeCost(method: string, path: string): number {
  if (path.includes("/transition")) return COST_TRANSITION;
  if (path.includes("/compute")) return COST_COMPUTE;
  if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE")
    return COST_WRITE;
  return COST_READ;
}

/**
 * Parses the IETF draft-8 `RateLimit` response header emitted by express-rate-limit
 * and extracts the remaining quota (r=) field.
 *
 * Header example:  "100-in-1min"; r=97; t=42
 * Returns the r value as a number, or null if absent/unparseable.
 */
function parseRateLimitRemaining(header: string | undefined): number | null {
  if (!header) return null;
  const match = /r=(\d+)/.exec(header);
  return match ? Number(match[1]) : null;
}

export function setQuotaRemainingHeader(res: Response): void {
  const remaining = parseRateLimitRemaining(res.getHeader("RateLimit") as string | undefined);
  if (remaining !== null) {
    res.setHeader("X-Quota-Remaining", String(remaining));
  }
}

/**
 * Mount globally via app.use() after correlationMiddleware.
 * Sets X-Request-Cost eagerly. X-Quota-Remaining is set by tenantRateLimiter
 * after express-rate-limit has populated the draft-8 RateLimit header.
 */
export function costHeaderMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cost = routeCost(req.method, req.path);

  // X-Request-Cost is set immediately — value is route-determined, not runtime-dependent
  res.setHeader("X-Request-Cost", String(cost));
  next();
}
