import type { Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";

let server: Server;
let baseUrl: string;

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
        "Access-Control-Request-Method": "POST",
        "Origin": "http://localhost:4566"
      },
      method: "OPTIONS"
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:4566");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST");
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
});
