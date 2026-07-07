import { describe, expect, it } from "vitest";

import { openApiDocument } from "../src/openapi/openapi.js";

interface SchemaWithProperties {
  properties: Record<string, unknown>;
  type: "object";
}

interface ResponseWithContent {
  content?: Record<string, { schema?: unknown }>;
}

const createFields = [
  "client_id",
  "due_date",
  "hold_reason",
  "on_hold",
  "owner",
  "planning_period",
  "priority"
];

const responseFields = [
  "client_id",
  "created_at",
  "due_date",
  "hold_reason",
  "id",
  "on_hold",
  "owner",
  "planning_period",
  "priority",
  "stage",
  "tenant_id",
  "updated_at"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireSchemaWithProperties(schema: unknown, name: string): SchemaWithProperties {
  if (typeof schema !== "object" || schema === null || !("type" in schema)) {
    throw new Error(`${name} must be an object schema`);
  }

  const type = schema.type;

  if (type !== "object" || !("properties" in schema)) {
    throw new Error(`${name} must be an object schema with properties`);
  }

  const properties = schema.properties;

  if (!isRecord(properties)) {
    throw new Error(`${name} must be an object schema with properties`);
  }

  return {
    properties,
    type
  };
}

function requireResponseWithContent(response: unknown, name: string): ResponseWithContent {
  if (typeof response !== "object" || response === null || "$ref" in response) {
    throw new Error(`${name} must include an inline response`);
  }

  return response;
}

describe("OpenAPI document", () => {
  it("is OpenAPI 3.1 and describes create and read cycle operations from schemas", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    const paths = openApiDocument.paths;

    if (!paths) {
      throw new Error("OpenAPI document must include paths");
    }

    expect(paths["/cycles"]?.post).toBeDefined();
    expect(paths["/cycles/{id}"]?.get).toBeDefined();

    const schemas = openApiDocument.components?.schemas ?? {};
    const createSchema = requireSchemaWithProperties(
      schemas.CreateCycleRequest,
      "CreateCycleRequest"
    );
    const responseSchema = requireSchemaWithProperties(schemas.CycleResponse, "CycleResponse");

    expect(createSchema).toMatchObject({
      type: "object"
    });
    expect(responseSchema).toMatchObject({
      type: "object"
    });

    expect(Object.keys(createSchema.properties ?? {}).sort()).toEqual(createFields);
    expect(Object.keys(responseSchema.properties ?? {}).sort()).toEqual(responseFields);

    const createRequestBody = paths["/cycles"]?.post?.requestBody;

    if (!createRequestBody || "$ref" in createRequestBody) {
      throw new Error("POST /cycles must include an inline request body");
    }

    expect(createRequestBody.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CreateCycleRequest"
    });

    const readOperation = paths["/cycles/{id}"]?.get;

    if (!readOperation) {
      throw new Error("GET /cycles/{id} operation must exist");
    }

    if (!readOperation.responses) {
      throw new Error("GET /cycles/{id} operation must include responses");
    }

    const readResponse = requireResponseWithContent(
      readOperation.responses["200"],
      "GET /cycles/{id}"
    );

    expect(readResponse.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CycleResponse"
    });
  });
});
