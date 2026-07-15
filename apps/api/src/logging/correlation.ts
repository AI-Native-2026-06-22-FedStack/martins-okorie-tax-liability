import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import type { pino } from "pino";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
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
  genReqId: (req) => {
    // Reuse the correlation ID determined by the outer middleware
    return (req as any).correlationId || randomUUID();
  },
  customProps: (req) => {
    return { correlationId: req.id };
  }
});

/**
 * Express middleware that reuses or generates a correlation ID.
 * Sets the header on the response early, then delegates to pino-http for logger wrapping.
 */
export function correlationMiddleware(req: any, res: any, next: any): void {
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
