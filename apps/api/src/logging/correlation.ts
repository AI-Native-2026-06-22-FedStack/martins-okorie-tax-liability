/* eslint-disable @typescript-eslint/no-namespace */
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { pinoHttp } from "pino-http";
import type { pino } from "pino";

import { REDACT_PATHS } from "./redaction-config.js";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      log: pino.Logger;
    }
  }
}

// Define the inner pino-http logger middleware
const correlationHttp = pinoHttp({
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]"
  },
  genReqId: (req: IncomingMessage) => {
    // Reuse the correlation ID determined by the outer middleware
    const expressReq = req as unknown as Request;
    return expressReq.correlationId || randomUUID();
  },
  customProps: (req: IncomingMessage) => {
    const expressReq = req as unknown as Request;
    return { correlationId: expressReq.id };
  }
});

/**
 * Express middleware that reuses or generates a correlation ID.
 * Sets the header on the response early, then delegates to pino-http for logger wrapping.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header("x-correlation-id") || req.header("x-request-id");
  const correlationId = incomingId ? String(incomingId) : randomUUID();

  // Set context property and response header
  req.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  // Call the pinoHttp middleware to attach req.log and trace requests
  correlationHttp(req, res, next);
}

// Export the internal logger instance
export const logger = correlationHttp.logger;
