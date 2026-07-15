import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  CreateCycleRequestSchema,
  CycleIdParamsSchema,
  CycleResponseSchema,
  TenantContextSchema
} from "../schemas/cycle.schema.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const createCycleRequest = registry.register("CreateCycleRequest", CreateCycleRequestSchema);
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

registry.registerPath({
  method: "post",
  path: "/cycles",
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
          schema: cycleResponse
        }
      },
      description: "Tax Plan Cycle opened"
    }
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
      description: "Tax Plan Cycle found"
    },
    404: {
      description: "Tax Plan Cycle not found"
    }
  },
  summary: "Get a tenant-scoped Tax Plan Cycle"
});

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
