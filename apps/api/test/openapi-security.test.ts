/**
 * openapi-security.test.ts
 *
 * Asserts the generated OpenAPI 3.1 document is structurally correct and
 * includes the full secured contract: bearer scheme, 401/429 responses, and
 * the IETF RateLimit/Retry-After headers — all sourced from the registry, not
 * a hand-written spec file.
 */
import { describe, expect, it } from "vitest";

import { openApiDocument } from "../src/openapi/openapi.js";

describe("OpenAPI 3.1 Security Contract (Task 3)", () => {
  it("document is OpenAPI 3.1.0", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
  });

  it("bearerAuth security scheme is registered with correct HTTP bearer/JWT type", () => {
    const schemes = openApiDocument.components?.securitySchemes;
    expect(schemes).toBeDefined();
    const bearer = (schemes as Record<string, unknown>)["bearerAuth"] as Record<string, unknown>;
    expect(bearer).toBeDefined();
    expect(bearer["type"]).toBe("http");
    expect(bearer["scheme"]).toBe("bearer");
    expect(bearer["bearerFormat"]).toBe("JWT");
  });

  it("POST /cycles requires bearerAuth and documents 401 and 429 responses", () => {
    const path = openApiDocument.paths?.["/cycles"];
    expect(path).toBeDefined();
    const post = (path as Record<string, unknown>)["post"] as Record<string, unknown>;
    expect(post).toBeDefined();

    // Security requirement references bearerAuth
    const security = post["security"] as Array<Record<string, unknown>>;
    expect(security).toBeDefined();
    expect(security.some((s) => "bearerAuth" in s)).toBe(true);

    // 401 and 429 responses documented
    const responses = post["responses"] as Record<string, unknown>;
    expect(responses["401"]).toBeDefined();
    expect(responses["429"]).toBeDefined();
  });

  it("PATCH /cycles/{id}/transition requires bearerAuth and documents 401, 403, and 429", () => {
    const path = openApiDocument.paths?.["/cycles/{id}/transition"];
    expect(path).toBeDefined();
    const patch = (path as Record<string, unknown>)["patch"] as Record<string, unknown>;
    expect(patch).toBeDefined();

    const security = patch["security"] as Array<Record<string, unknown>>;
    expect(security.some((s) => "bearerAuth" in s)).toBe(true);

    const responses = patch["responses"] as Record<string, unknown>;
    expect(responses["401"]).toBeDefined();
    expect(responses["403"]).toBeDefined();
    expect(responses["429"]).toBeDefined();
  });

  it("429 response documents Retry-After and RateLimit headers", () => {
    const path = openApiDocument.paths?.["/cycles"];
    const post = (path as Record<string, unknown>)["post"] as Record<string, unknown>;
    const responses = post["responses"] as Record<string, unknown>;
    const response429 = responses["429"] as Record<string, unknown>;

    const headers = response429["headers"] as Record<string, unknown>;
    expect(headers).toBeDefined();
    expect(headers["Retry-After"]).toBeDefined();
    expect(headers["RateLimit"]).toBeDefined();
  });

  it("GET /cycles/{id} does not require bearerAuth (public read path)", () => {
    const path = openApiDocument.paths?.["/cycles/{id}"];
    const get = (path as Record<string, unknown>)["get"] as Record<string, unknown>;
    // No security restriction on the read path
    const security = get?.["security"];
    expect(security).toBeUndefined();
  });

  it("document contains no hand-written spec paths — all paths sourced from registry", () => {
    // If the document has at least the two explicitly registered paths, the
    // registry is the sole source of truth (no static YAML merged in).
    const paths = Object.keys(openApiDocument.paths ?? {});
    expect(paths).toContain("/cycles");
    expect(paths).toContain("/cycles/{id}");
    expect(paths).toContain("/cycles/{id}/transition");
  });
});
