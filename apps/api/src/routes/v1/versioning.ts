import type { NextFunction, Request, Response } from "express";

export const API_V1_PREFIX = "/v1";
export const DEPRECATION_DATE = "2026-07-15T00:00:00.000Z";
export const DEPRECATION_HEADER = "@1784073600";
export const SUNSET_HEADER = "Thu, 15 Jan 2027 00:00:00 GMT";
export const SUCCESSOR_LINK = '</health>; rel="successor-version"';

export function deprecatedCyclePingHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Deprecation", DEPRECATION_HEADER);
  res.setHeader("Sunset", SUNSET_HEADER);
  res.setHeader("Link", SUCCESSOR_LINK);
  next();
}
