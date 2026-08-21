import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Generates an AWS X-Ray compliant trace ID.
 * Format: 1-{8-hex-epoch}-{24-hex-random}
 */
export function generateXRayTraceId(): string {
  const epoch = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const random = randomBytes(12).toString("hex");
  return `1-${epoch}-${random}`;
}

/**
 * Formats an AWS X-Ray HTTP Header value.
 */
export function formatXRayHeader(traceId: string, parentId?: string): string {
  if (parentId) {
    return `Root=${traceId};Parent=${parentId};Sampled=1`;
  }
  return `Root=${traceId};Sampled=1`;
}

/**
 * Parses an incoming X-Amzn-Trace-Id header if present.
 */
export function parseXRayTraceId(headerValue?: string): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/Root=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Exports a span trace segment to the local ADOT OTLP collector (port 4318 HTTP).
 * Fails safely/silently if the collector is unreachable during offline tests.
 */
export async function exportSpanToAdot(span: {
  traceId: string;
  name: string;
  service: string;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  attributes?: Record<string, string | number | boolean>;
}): Promise<void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";
  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: span.service } },
            { key: "cloud.provider", value: { stringValue: "aws" } }
          ]
        },
        scopeSpans: [
          {
            scope: { name: "@taxpulse/api-tracing" },
            spans: [
              {
                traceId: span.traceId.replace(/-/g, ""),
                spanId: randomBytes(8).toString("hex"),
                name: span.name,
                kind: 1, // SPAN_KIND_INTERNAL
                startTimeUnixNano: String(span.startTimeUnixNano),
                endTimeUnixNano: String(span.endTimeUnixNano),
                attributes: Object.entries(span.attributes || {}).map(([k, v]) => ({
                  key: k,
                  value: typeof v === "number" ? { intValue: String(v) } : { stringValue: String(v) }
                }))
              }
            ]
          }
        ]
      }
    ]
  };

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1000)
    }).catch(() => {
      // Non-blocking in dev / test environments
    });
  } catch {
    // Ignore offline collector failures
  }
}

/**
 * OpenTelemetry X-Ray Tracing Express Middleware.
 * Extracts or generates X-Ray trace context and binds it to the request and response.
 */
export function xrayTracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingHeader = req.header("x-amzn-trace-id");
  const traceId = parseXRayTraceId(incomingHeader) || generateXRayTraceId();
  const startTime = Date.now() * 1_000_000;

  // Attach to request context
  (req as unknown as { traceId: string }).traceId = traceId;
  res.setHeader("X-Amzn-Trace-Id", formatXRayHeader(traceId));

  res.on("finish", () => {
    const endTime = Date.now() * 1_000_000;
    exportSpanToAdot({
      traceId,
      name: `${req.method} ${req.path}`,
      service: "taxpulse-core-case-service",
      startTimeUnixNano: startTime,
      endTimeUnixNano: endTime,
      attributes: {
        "http.method": req.method,
        "http.target": req.path,
        "http.status_code": res.statusCode
      }
    });
  });

  next();
}
