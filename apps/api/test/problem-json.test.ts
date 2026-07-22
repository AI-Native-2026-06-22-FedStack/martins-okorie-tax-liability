import type { Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { signAccessToken } from "../src/auth/tokens.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

let server: Server;
let baseUrl: string;

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("Problem+JSON error responses", () => {
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

  it("returns exactly the RFC 9457 members for a malformed cycle create request", async () => {
    const token = signAccessToken({ sub: "user-123", tenant_id: TENANT_ID, role: "Firm Admin" });
    const response = await fetch(`${baseUrl}/cycles`, {
      body: JSON.stringify({
        due_date: "2026-12-31",
        owner: "Fictional Advisor",
        planning_period: "2026 Q4",
        priority: "P1"
      }),
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
      },
      method: "POST"
    });

    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(Object.keys(body).sort()).toEqual(["detail", "instance", "status", "title", "type"]);
    expect(body).toMatchObject({
      instance: "/cycles",
      status: 400,
      title: "Invalid Request",
      type: "about:blank"
    });
    expect(body.detail).toContain("client_id");
  });
});
