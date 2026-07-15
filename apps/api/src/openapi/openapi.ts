import "./extend-zod.js";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  CreateCycleRequestSchema,
  CreateCycleResponseSchema,
  CycleIdParamsSchema,
  CycleResponseSchema,
  TenantContextSchema
} from "../db/dto.js";

const registry = new OpenAPIRegistry();

// ─── Security scheme ─────────────────────────────────────────────────────────
// Registered once on the registry so every protected path can reference it.
// The scheme definition flows into the generated document via OpenApiGeneratorV31
// — no hand-written spec file is maintained alongside this source.
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "RS256 JWT issued by /auth/mfa. Carries tenant_id, role, sub, iss, and aud claims."
});

// ─── Shared 401 / 429 response objects ───────────────────────────────────────
// Reused across all protected paths so the failure contract is stated once.
const response401 = {
  description: "Missing or invalid bearer token",
  content: {
    "application/problem+json": {
      schema: z.object({
        type: z.string(),
        title: z.string(),
        status: z.literal(401),
        detail: z.string()
      })
    }
  }
};

const response429 = {
  description:
    "Too Many Requests — per-tenant rate limit exceeded. " +
    "The RateLimit header on preceding 2xx responses showed the remaining budget. " +
    "Rate-limit header spec: IETF draft-ietf-httpapi-ratelimit-headers (not RFC 9239).",
  headers: {
    "Retry-After": {
      description: "Seconds until the rate-limit window resets",
      schema: { type: "integer", example: 60 }
    } as const,
    RateLimit: {
      description:
        "IETF draft-8 combined header: quota name, remaining (r=), and reset (t=)",
      schema: {
        type: "string",
        example: '"100-in-1min"; r=0; t=42'
      }
    } as const,
    "RateLimit-Policy": {
      description: "Policy: quota (q=), window seconds (w=), partition key (pk=)",
      schema: {
        type: "string",
        example: '"100-in-1min"; q=100; w=60; pk=:dGVuYW50X2lk:'
      }
    } as const
  },
  content: {
    "application/problem+json": {
      schema: z.object({
        type: z.string(),
        title: z.string(),
        status: z.literal(429),
        detail: z.string()
      })
    }
  }
};

const rateLimitHeaders = {
  RateLimit: {
    description:
      "IETF draft-8 combined header for the current request: quota name, remaining (r=), and reset (t=)",
    schema: {
      type: "string",
      example: '"3-in-1min"; r=2; t=42'
    }
  } as const,
  "RateLimit-Policy": {
    description: "IETF draft-8 quota policy: quota (q=), window seconds (w=), and partition key (pk=)",
    schema: {
      type: "string",
      example: '"3-in-1min"; q=3; w=60; pk=:dGVuYW50X2lk:'
    }
  } as const
};

const costAccountingHeaders = {
  "X-Request-Cost": {
    description:
      "TaxPulse advisory cost units accounted for this request. Value is per-request, per-tenant, and reflects the operation performed.",
    schema: {
      type: "integer",
      example: 2
    }
  } as const,
  "X-Quota-Remaining": {
    description:
      "TaxPulse advisory remaining tenant quota for the current rate-limit window, derived from the RateLimit r= value.",
    schema: {
      type: "integer",
      example: 2
    }
  } as const
};

const allowedQuotaHeaders = {
  ...rateLimitHeaders,
  ...costAccountingHeaders
};

// ─── Schema registration ──────────────────────────────────────────────────────
const createCycleRequest = registry.register("CreateCycleRequest", CreateCycleRequestSchema);
const createCycleResponse = registry.register("CreateCycleResponse", CreateCycleResponseSchema);
const cycleResponse = registry.register("CycleResponse", CycleResponseSchema);
const cycleIdParams = z.object({
  id: CycleIdParamsSchema.shape.id.openapi({
    param: {
      in: "path",
      name: "id",
      required: true
    }
  })
});
const tenantHeaders = z.object({
  "x-tenant-id": TenantContextSchema.shape.tenant_id.openapi({
    param: {
      in: "header",
      name: "x-tenant-id",
      required: true
    }
  })
});

// ─── Paths ────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: "/cycles",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createCycleRequest
        }
      },
      required: true
    },
    headers: tenantHeaders
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createCycleResponse
        }
      },
      headers: allowedQuotaHeaders,
      description: "Tax Plan Cycle opened"
    },
    401: response401,
    429: response429
  },
  summary: "Open a Tax Plan Cycle"
});

registry.registerPath({
  method: "get",
  path: "/cycles/{id}",
  request: {
    headers: tenantHeaders,
    params: cycleIdParams
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: cycleResponse
        }
      },
      headers: costAccountingHeaders,
      description: "Tax Plan Cycle found"
    },
    404: {
      description: "Tax Plan Cycle not found"
    }
  },
  summary: "Get a tenant-scoped Tax Plan Cycle"
});

registry.registerPath({
  method: "post",
  path: "/cycles/{id}/compute",
  security: [{ bearerAuth: [] }],
  request: {
    params: cycleIdParams,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            income: z.number().optional().openapi({ example: 250000 }),
            deductions: z.number().optional().openapi({ example: 40000 })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: "Real-time tax-liability calculation returned",
      headers: allowedQuotaHeaders
    },
    401: response401,
    429: response429
  },
  summary: "Compute real-time tax liability for a Tax Plan Cycle"
});

registry.registerPath({
  method: "patch",
  path: "/cycles/{id}/transition",
  security: [{ bearerAuth: [] }],
  request: {
    params: cycleIdParams,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            toStage: z.string().openapi({ example: "Modeling" }),
            reason: z.string().optional().openapi({ example: "Data aggregation complete" })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: "Stage transition recorded and audit entry written",
      headers: allowedQuotaHeaders
    },
    401: response401,
    403: { description: "Forbidden — role not authorized for this transition" },
    429: response429
  },
  summary: "Transition a Tax Plan Cycle stage"
});

// ─── Document generation ──────────────────────────────────────────────────────
// Uses the same registry populated above — no hand-written spec file alongside.
const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  info: {
    title: "TaxPulse API",
    version: "0.1.0"
  },
  openapi: "3.1.0",
  servers: [
    {
      url: "http://localhost:3000"
    }
  ]
});
