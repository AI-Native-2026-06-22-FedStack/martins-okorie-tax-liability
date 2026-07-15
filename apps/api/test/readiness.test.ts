import type { Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checkDatabaseReady, createDrizzleDb } from "../src/db/client.js";
import { app } from "../src/app.js";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

let server: Server;
let baseUrl: string;

describeWithDatabase("readiness endpoint", () => {
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

  it("returns ready when the Testcontainers database is reachable", async () => {
    const response = await fetch(`${baseUrl}/ready`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      database: "ok",
      service: "taxpulse-api",
      status: "ready"
    });
  });
});

describe("database readiness helper", () => {
  it("rejects when the database dependency is unreachable", async () => {
    const connection = createDrizzleDb("postgresql://taxpulse-invalid@127.0.0.1:1/taxpulse", {
      poolMax: 1
    });

    try {
      await expect(checkDatabaseReady(connection)).rejects.toThrow();
    } finally {
      await connection.pool.end();
    }
  });
});
