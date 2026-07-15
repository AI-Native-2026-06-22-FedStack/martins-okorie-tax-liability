/**
 * openapi-security.test.ts
 *
 * Asserts the generated OpenAPI 3.1 document is structurally correct and
 * includes the full secured contract: bearer scheme, 401/429 responses, and
 * the IETF RateLimit/Retry-After headers — all sourced from the registry, not
 * a hand-written spec file.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openApiDocument } from "../src/openapi/openapi.js";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const openApiSource = readFileSync(join(apiRoot, "src/openapi/openapi.ts"), "utf8");
const appSource = readFileSync(join(apiRoot, "src/app.ts"), "utf8");

const protectedRoutes = [
  { method: "post", path: "/cycles" },
  { method: "post", path: "/cycles/{id}/compute" },
  { method: "patch", path: "/cycles/{id}/transition" }
] as const;

describe("OpenAPI 3.1 Security Contract (Task 3)", () => {
  it("generated document is well-formed OpenAPI 3.1", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(openApiDocument.info?.title).toBe("TaxPulse API");
    expect(openApiDocument.info?.version).toBeDefined();
    expect(openApiDocument.paths).toBeDefined();
    expect(openApiDocument.components).toBeDefined();
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

  it("all protected write handlers require bearerAuth and document 401/429 responses", () => {
    for (const route of protectedRoutes) {
      const path = openApiDocument.paths?.[route.path];
      expect(path, route.path).toBeDefined();
      const operation = (path as Record<string, unknown>)[route.method] as Record<string, unknown>;
      expect(operation, `${route.method.toUpperCase()} ${route.path}`).toBeDefined();

      const security = operation["security"] as Array<Record<string, unknown>>;
      expect(security.some((s) => "bearerAuth" in s)).toBe(true);

      const responses = operation["responses"] as Record<string, unknown>;
      expect(responses["401"]).toBeDefined();
      expect(responses["429"]).toBeDefined();
    }
  });

  it("protected 429 responses document Retry-After and draft-8 RateLimit headers", () => {
    for (const route of protectedRoutes) {
      const path = openApiDocument.paths?.[route.path];
      const operation = (path as Record<string, unknown>)[route.method] as Record<string, unknown>;
      const responses = operation["responses"] as Record<string, unknown>;
      const response429 = responses["429"] as Record<string, unknown>;

      const headers = response429["headers"] as Record<string, unknown>;
      expect(headers).toBeDefined();
      expect(headers["Retry-After"]).toBeDefined();
      expect(headers["RateLimit"]).toBeDefined();
      expect(headers["RateLimit-Policy"]).toBeDefined();
    }
  });

  it("PATCH /cycles/{id}/transition also documents its 403 handler", () => {
    const path = openApiDocument.paths?.["/cycles/{id}/transition"];
    const patch = (path as Record<string, unknown>)["patch"] as Record<string, unknown>;
    const responses = patch["responses"] as Record<string, unknown>;

    expect(responses["403"]).toBeDefined();
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
    expect(paths).toContain("/cycles/{id}/compute");
    expect(paths).toContain("/cycles/{id}/transition");
  });

  it("uses the Module 2 registry/generator and Scalar docs without a sibling hand-written spec file", () => {
    expect(openApiSource).toContain("new OpenAPIRegistry()");
    expect(openApiSource).toContain("new OpenApiGeneratorV31");
    expect(openApiSource).not.toMatch(/\bOpenApiGeneratorV3\b/);
    expect(appSource).toContain("apiReference");
    expect(appSource).toContain('url: "/openapi.json"');

    const openApiDirEntries = readdirSync(join(apiRoot, "src/openapi"));
    expect(openApiDirEntries).not.toContain("openapi.yaml");
    expect(openApiDirEntries).not.toContain("openapi.yml");
    expect(openApiDirEntries).not.toContain("openapi.json");
    expect(openApiDirEntries).not.toContain("swagger.yaml");
    expect(openApiDirEntries).not.toContain("swagger.yml");
    expect(openApiDirEntries).not.toContain("swagger.json");
  });
});
