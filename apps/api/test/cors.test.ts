import type { Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { signAccessToken } from "../src/auth/tokens.js";

let server: Server;
let baseUrl: string;
const spaCloudFrontOrigin = "http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566";
const tenantId = "11111111-1111-4111-8111-111111111111";

describe("SPA CORS configuration", () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("allows the exact floci CloudFront origin and Authorization header on preflight", async () => {
    const response = await fetch(`${baseUrl}/v1/cycles`, {
      headers: {
        "Access-Control-Request-Headers": "Authorization, Content-Type",
        "Access-Control-Request-Method": "PATCH",
        "Origin": spaCloudFrontOrigin
      },
      method: "OPTIONS"
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(spaCloudFrontOrigin);
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, PATCH");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
  });

  it("rejects preflight requests from origins other than the configured SPA origin", async () => {
    const response = await fetch(`${baseUrl}/v1/cycles`, {
      headers: {
        "Access-Control-Request-Headers": "Authorization",
        "Access-Control-Request-Method": "POST",
        "Origin": "http://localhost:5173"
      },
      method: "OPTIONS"
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("keeps the bearer token on an authenticated cross-origin request", async () => {
    const token = signAccessToken({ role: "Firm Admin", sub: "advisor-123", tenant_id: tenantId });
    const response = await fetch(`${baseUrl}/v1/cycles`, {
      body: JSON.stringify({}),
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Origin": spaCloudFrontOrigin
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("access-control-allow-origin")).toBe(spaCloudFrontOrigin);
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
  });
});
