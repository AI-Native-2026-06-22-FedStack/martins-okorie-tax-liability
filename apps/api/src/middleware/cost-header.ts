import type { NextFunction, Request, Response } from "express";

/**
 * cost-header.ts — Quota and cost-accounting response middleware.
 *
 * Emits two non-standard advisory headers on every response so consumers can
 * track per-request cost and cumulative quota consumption without needing a
 * separate quota API call:
 *
 *   X-Request-Cost:       integer — the relative cost unit charged for this
 *                         operation (write=2, read=1, transition=3).
 *   X-Quota-Used:         integer — running tally of cost units consumed by
 *                         this tenant in the current rate-limit window.
 *                         Derived from the limiter's `ratelimit` header that
 *                         express-rate-limit already sets on the response.
 *
 * These are advisory only: enforcement is the job of the rate limiter.
 * A platform engineer can adjust COST_WRITE / COST_TRANSITION / COST_READ via
 * env vars without a code change.
 */

const COST_WRITE = Number(process.env.COST_WRITE ?? 2);
const COST_TRANSITION = Number(process.env.COST_TRANSITION ?? 3);
const COST_READ = Number(process.env.COST_READ ?? 1);

function routeCost(method: string, path: string): number {
  if (path.includes("/transition")) return COST_TRANSITION;
  if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE")
    return COST_WRITE;
  return COST_READ;
}

/**
 * Parses the IETF draft-8 `RateLimit` response header emitted by
 * express-rate-limit and extracts the remaining quota value.
 *
 * Header example:  "100-in-1min"; r=97; t=42
 * Returns the `r` (remaining) field as a number, or null if absent/unparseable.
 */
function parseRateLimitRemaining(header: string | undefined): number | null {
  if (!header) return null;
  const match = /r=(\d+)/.exec(header);
  return match ? Number(match[1]) : null;
}

/**
 * Mount on every route (or selected routes) as a response-phase middleware.
 * Sets X-Request-Cost eagerly (before the handler runs) and defers
 * X-Quota-Used to just before the first response write so it can read the
 * RateLimit header that express-rate-limit has already set.
 */
export function costHeaderMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cost = routeCost(req.method, req.path);

  // Set cost header immediately — it is known before the handler runs
  res.setHeader("X-Request-Cost", String(cost));

  // Intercept writeHead to inject X-Quota-Used while headers are still mutable
  const originalWriteHead = res.writeHead.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).writeHead = function (...args: Parameters<typeof res.writeHead>) {
    const remaining = parseRateLimitRemaining(res.getHeader("RateLimit") as string | undefined);
    const limit = Number(process.env.RATE_LIMIT_MAX ?? 100);
    if (remaining !== null) {
      const used = (limit - remaining) * cost;
      res.setHeader("X-Quota-Used", String(used));
    }
    return originalWriteHead(...args);
  };

  next();
}
