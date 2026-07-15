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
  "metadata",
  "on_hold",
  "owner",
  "planning_period",
  "priority",
  "stage",
  "tenant_id",
  "updated_at"
];

const createResponseFields = ["id"];

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
  if (typeof response !== "object" || response === null) {
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

    expect(paths["/v1/cycles"]?.post).toBeDefined();
    expect(paths["/v1/cycles/{id}"]?.get).toBeDefined();

    const schemas = openApiDocument.components?.schemas ?? {};
    const createSchema = requireSchemaWithProperties(
      schemas.CreateCycleRequest,
      "CreateCycleRequest"
    );
    const responseSchema = requireSchemaWithProperties(schemas.CycleResponse, "CycleResponse");
    const createResponseSchema = requireSchemaWithProperties(
      schemas.CreateCycleResponse,
      "CreateCycleResponse"
    );

    expect(createSchema).toMatchObject({
      type: "object"
    });
    expect(responseSchema).toMatchObject({
      type: "object"
    });

    expect(Object.keys(createSchema.properties ?? {}).sort()).toEqual(createFields);
    expect(Object.keys(createResponseSchema.properties ?? {}).sort()).toEqual(createResponseFields);
    expect(Object.keys(responseSchema.properties ?? {}).sort()).toEqual(responseFields);

    const createRequestBody = paths["/v1/cycles"]?.post?.requestBody;

    if (!createRequestBody || "$ref" in createRequestBody) {
      throw new Error("POST /v1/cycles must include an inline request body");
    }

    expect(createRequestBody.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CreateCycleRequest"
    });

    const createResponse = requireResponseWithContent(
      paths["/v1/cycles"]?.post?.responses?.["201"],
      "POST /v1/cycles"
    );

    expect(createResponse.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CreateCycleResponse"
    });

    const readOperation = paths["/v1/cycles/{id}"]?.get;

    if (!readOperation) {
      throw new Error("GET /v1/cycles/{id} operation must exist");
    }

    if (!readOperation.responses) {
      throw new Error("GET /cycles/{id} operation must include responses");
    }

    const readResponse = requireResponseWithContent(
      readOperation.responses["200"],
      "GET /v1/cycles/{id}"
    );

    expect(readResponse.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CycleResponse"
    });
  });
});
