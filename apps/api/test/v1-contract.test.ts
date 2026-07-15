import request from "supertest";
import type { Express } from "express";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { signAccessToken } from "../src/auth/tokens.js";

vi.mock("../src/services/cycle.service.js", () => ({
  createCycle: vi.fn(async () => ({ id: "33333333-3333-4333-8333-333333333333" })),
  getCycleById: vi.fn(),
  getCyclePing: vi.fn(async () => ({
    dataAccess: "repository",
    service: "taxpulse-api",
    status: "ok"
  })),
  throwCycleError: vi.fn(async () => {
    throw new Error("Synthetic cycle route failure");
  })
}));

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const token = signAccessToken({
  sub: "advisor-v1-contract@taxpulse.example",
  tenant_id: TENANT_ID,
  role: "Advisor"
});

const createCycleBody = {
  client_id: "fictional-client-v1-contract",
  due_date: "2026-09-30",
  hold_reason: null,
  on_hold: false,
  owner: "Fictional Advisor",
  planning_period: "2026 Q3",
  priority: "P1"
};

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, unknown>;
  };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveSchema(schema: unknown, document: OpenApiDocument): Record<string, unknown> {
  if (!isRecord(schema)) {
    throw new Error("OpenAPI schema must be an object");
  }

  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace("#/components/schemas/", "");
    const resolved = document.components?.schemas?.[name];
    if (!isRecord(resolved)) {
      throw new Error(`OpenAPI schema ref ${schema.$ref} did not resolve`);
    }
    return resolved;
  }

  return schema;
}

function schemaForJsonBody(bodyOrResponse: unknown, document: OpenApiDocument): Record<string, unknown> {
  if (!isRecord(bodyOrResponse) || "$ref" in bodyOrResponse) {
    throw new Error("OpenAPI body/response must be inline");
  }

  const content = bodyOrResponse.content;
  if (!isRecord(content)) {
    throw new Error("OpenAPI body/response must include content");
  }

  const jsonContent = content["application/json"];
  if (!isRecord(jsonContent)) {
    throw new Error("OpenAPI body/response must include application/json content");
  }

  return resolveSchema(jsonContent.schema, document);
}

function assertJsonValueMatchesSchema(
  value: unknown,
  schema: Record<string, unknown>,
  document: OpenApiDocument
): void {
  const resolved = resolveSchema(schema, document);

  const anyOf = resolved.anyOf;
  if (Array.isArray(anyOf)) {
    const errors: unknown[] = [];
    for (const option of anyOf) {
      if (!isRecord(option)) {
        continue;
      }
      try {
        assertJsonValueMatchesSchema(value, option, document);
        return;
      } catch (error) {
        errors.push(error);
      }
    }

    throw new Error(`Value did not match any allowed schema: ${errors.length} failures`);
  }

  if (Array.isArray(resolved.enum) && !resolved.enum.includes(value)) {
    throw new Error(`Value ${String(value)} was not in schema enum`);
  }

  if ("const" in resolved && value !== resolved.const) {
    throw new Error(`Value ${String(value)} did not match schema const ${String(resolved.const)}`);
  }

  const types = Array.isArray(resolved.type) ? resolved.type : [resolved.type];
  const expectedTypes = types.filter((type): type is string => typeof type === "string");
  if (expectedTypes.length > 0 && !expectedTypes.some((type) => valueMatchesType(value, type))) {
    throw new Error(`Value ${String(value)} did not match schema type ${expectedTypes.join("|")}`);
  }

  if (!expectedTypes.includes("object") && resolved.properties === undefined) {
    return;
  }

  if (!isRecord(value)) {
    throw new Error("Value must be an object");
  }

  const properties = resolved.properties;
  if (!isRecord(properties)) {
    throw new Error("Schema must define object properties");
  }

  const required = Array.isArray(resolved.required) ? resolved.required : [];
  for (const field of required) {
    if (typeof field === "string" && !(field in value)) {
      throw new Error(`Missing required field ${field}`);
    }
  }

  for (const field of Object.keys(value)) {
    if (!(field in properties)) {
      throw new Error(`Unexpected field ${field}`);
    }

    const propertySchema = properties[field];
    if (isRecord(propertySchema)) {
      assertJsonValueMatchesSchema(value[field], propertySchema, document);
    }
  }
}

function valueMatchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "null":
      return value === null;
    case "number":
      return typeof value === "number";
    case "object":
      return isRecord(value);
    case "string":
      return typeof value === "string";
    default:
      return true;
  }
}

describe("v1 REST contract", () => {
  let app: Express;
  let openApiDocument: OpenApiDocument;

  beforeAll(async () => {
    ({ app } = await import("../src/app.js"));
    ({ openApiDocument } = await import("../src/openapi/openapi.js"));
  });

  it("keeps health unversioned and returns 404 for an unknown version prefix", async () => {
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);

    const unknownVersion = await request(app).post("/v2/cycles").send(createCycleBody);
    expect(unknownVersion.status).toBe(404);

    const unversionedCycleRoute = await request(app).get("/cycles/ping");
    expect(unversionedCycleRoute.status).toBe(404);
  });

  it("serves POST /v1/cycles according to the published OpenAPI request and response schemas", async () => {
    const operation = openApiDocument.paths?.["/v1/cycles"]?.post;
    expect(operation).toBeDefined();

    const requestSchema = schemaForJsonBody(operation?.requestBody, openApiDocument);
    assertJsonValueMatchesSchema(createCycleBody, requestSchema, openApiDocument);

    const response = await request(app)
      .post("/v1/cycles")
      .set("Authorization", `Bearer ${token}`)
      .send(createCycleBody);

    expect(response.status).toBe(201);

    const response201 = operation?.responses?.["201"];
    const responseSchema = schemaForJsonBody(response201, openApiDocument);
    assertJsonValueMatchesSchema(response.body, responseSchema, openApiDocument);
    expect(() => assertJsonValueMatchesSchema({}, responseSchema, openApiDocument)).toThrow(
      /Missing required field id/
    );
  });

  it("announces the deprecated v1 ping route while keeping it working", async () => {
    const response = await request(app).get("/v1/cycles/ping");

    expect(response.status).toBe(200);
    expect(response.get("Deprecation")).toBe("@1784073600");
    expect(response.get("Link")).toBe('</health>; rel="successor-version"');

    const deprecationSeconds = Number(response.get("Deprecation")?.replace("@", ""));
    const sunsetMs = Date.parse(response.get("Sunset") ?? "");
    expect(Number.isNaN(deprecationSeconds)).toBe(false);
    expect(Number.isNaN(sunsetMs)).toBe(false);
    expect(sunsetMs).toBeGreaterThanOrEqual(deprecationSeconds * 1000);
  });
});
