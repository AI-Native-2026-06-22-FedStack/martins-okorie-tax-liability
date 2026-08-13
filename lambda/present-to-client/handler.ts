import { randomUUID } from "node:crypto";
import { Logger } from "@aws-lambda-powertools/logger";

interface ApiGatewayHttpEvent {
  body?: string | null;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    authorizer?: {
      jwt?: {
        claims?: Record<string, string | undefined>;
      };
    };
    http?: {
      method?: string;
      path?: string;
    };
    requestId?: string;
  };
}

interface LambdaContext {
  awsRequestId: string;
  functionName: string;
  invokedFunctionArn?: string;
  memoryLimitInMB?: string;
}

interface PresentToClientCommand {
  actionItems: {
    deadline: string;
    description: string;
  }[];
  actor: string;
  cycleId: string;
  tenantId: string;
}

interface PresentToClientRequestBody {
  actionItems?: unknown;
  cycleId?: unknown;
}

interface VerifiedClaims {
  actor: string;
  role: string;
  tenantId: string;
}

interface ProxyResponse {
  body: string;
  headers: Record<string, string>;
  statusCode: number;
}

interface PresentToClientForwarder {
  forward: (command: PresentToClientCommand, correlationId: string) => Promise<Response>;
  initId: string;
}

const logger = new Logger({ serviceName: "present-to-client" });
const presentToClientForwarder = createPresentToClientForwarder();
const spaCloudFrontOrigin =
  process.env.SPA_CLOUDFRONT_ORIGIN ??
  "http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566";
const corsHeaders = {
  "access-control-allow-headers": "Content-Type, Authorization, X-Correlation-Id",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": spaCloudFrontOrigin,
  "vary": "Origin"
};

function createPresentToClientForwarder(): PresentToClientForwarder {
  const apiBaseUrl = new URL(process.env.TAXPULSE_API_BASE_URL ?? "http://api:3000");
  const apiRoute = "/v1/transitions/present-to-client";
  const initId = randomUUID();

  return {
    forward: async (command, correlationId) =>
      fetch(new URL(apiRoute, apiBaseUrl), {
        body: JSON.stringify(command),
        headers: {
          "content-type": "application/json",
          "x-correlation-id": correlationId
        },
        method: "POST"
      }),
    initId
  };
}

export async function handler(
  event: ApiGatewayHttpEvent,
  context: LambdaContext
): Promise<ProxyResponse> {
  logger.addContext(context);

  const correlationId =
    event.headers?.["x-correlation-id"] ??
    event.headers?.["x-request-id"] ??
    event.requestContext?.requestId ??
    context.awsRequestId;

  if (event.requestContext?.http?.method === "OPTIONS") {
    return {
      body: "",
      headers: corsHeaders,
      statusCode: 204
    };
  }

  logger.setCorrelationId(correlationId);
  logger.info("present-to-client command received", {
    initId: presentToClientForwarder.initId,
    method: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path
  });

  const claims = parseVerifiedClaims(event);
  if (!claims) {
    logger.warn("present-to-client command rejected for missing verified claims", {
      initId: presentToClientForwarder.initId
    });

    return jsonResponse(401, correlationId, {
      detail: "Verified actor, tenant, and role claims are required.",
      status: 401,
      title: "Unauthorized",
      type: "about:blank"
    });
  }

  if (claims.role !== "Firm Admin") {
    logger.warn("present-to-client command rejected by role gate", {
      initId: presentToClientForwarder.initId,
      role: claims.role
    });

    return jsonResponse(403, correlationId, {
      detail: "Firm Admin role is required to present a reviewed Tax Plan Cycle to the client.",
      status: 403,
      title: "Forbidden",
      type: "about:blank"
    });
  }

  const command = parseCommand(event.body, claims);
  if (!command) {
    logger.warn("present-to-client command rejected for invalid body", {
      initId: presentToClientForwarder.initId
    });

    return jsonResponse(400, correlationId, {
      detail: "cycleId and at least one action item are required.",
      status: 400,
      title: "Bad Request",
      type: "about:blank"
    });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await presentToClientForwarder.forward(command, correlationId);
  } catch (error) {
    logger.error("present-to-client command forward failed", {
      errorMessage: error instanceof Error ? error.message : "unknown error",
      initId: presentToClientForwarder.initId
    });

    return jsonResponse(502, correlationId, {
      detail: "Core Case Service did not accept the present-to-client command.",
      status: 502,
      title: "Bad Gateway",
      type: "about:blank"
    });
  }

  const responseBody = await upstreamResponse.text();

  logger.info("present-to-client command forwarded", {
    initId: presentToClientForwarder.initId,
    upstreamStatus: upstreamResponse.status
  });

  return {
    body: responseBody || JSON.stringify({ accepted: upstreamResponse.ok }),
    headers: {
      ...corsHeaders,
      "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
      "x-correlation-id": correlationId
    },
    statusCode: upstreamResponse.status
  };
}

function parseVerifiedClaims(event: ApiGatewayHttpEvent): VerifiedClaims | null {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const actor = claims?.sub;
  const role = claims?.role;
  const tenantId = claims?.tenant_id;

  if (!actor || !role || !tenantId) {
    return null;
  }

  return { actor, role, tenantId };
}

function parseCommand(
  body: string | null | undefined,
  claims: VerifiedClaims
): PresentToClientCommand | null {
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as PresentToClientRequestBody;
    const actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
    const { cycleId } = parsed;
    const hasCycleId = typeof cycleId === "string";
    const hasActionItems =
      actionItems.length > 0 &&
      actionItems.every(
        (item): item is PresentToClientCommand["actionItems"][number] =>
          typeof item === "object" &&
          item !== null &&
          "deadline" in item &&
          "description" in item &&
          typeof item.deadline === "string" &&
          typeof item.description === "string"
      );

    if (!hasCycleId || !hasActionItems) {
      return null;
    }

    return {
      actionItems,
      actor: claims.actor,
      cycleId,
      tenantId: claims.tenantId
    };
  } catch {
    return null;
  }
}

function jsonResponse(
  statusCode: number,
  correlationId: string,
  body: Record<string, unknown>
): ProxyResponse {
  return {
    body: JSON.stringify(body),
    headers: {
      ...corsHeaders,
      "content-type": "application/problem+json",
      "x-correlation-id": correlationId
    },
    statusCode
  };
}
