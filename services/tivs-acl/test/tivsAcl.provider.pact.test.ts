import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { Verifier } from "@pact-foundation/pact";
import { describe, expect, it } from "vitest";
import { TaxpayerIdentifierNotFoundError } from "../src/acl/dto.js";
import { renderAuditLine } from "../src/audit.js";
import { createTivsBreaker, TIVS_BREAKER_OPTIONS } from "../src/breaker.js";
import { createApp } from "../src/server.js";
import { TivsClient } from "../src/soap/tivsClient.js";

const pactContract = {
  consumer: { name: "taxpulse-api" },
  interactions: [
    {
      description: "an Intake request to verify a taxpayer identifier",
      providerStates: [{ name: "TIVS has a matching taxpayer identifier" }],
      request: {
        body: {
          clientId: "client-synthetic-001",
          legalName: "SYNTHETIC TAXPAYER LLC",
          taxpayerId: "000001234",
          taxpayerIdType: "EIN",
        },
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": "pact-correlation-id",
        },
        method: "POST",
        path: "/v1/taxpayer-verifications",
      },
      response: {
        body: {
          decision: "matched",
          matched: true,
          verifiedLegalName: "SYNTHETIC TAXPAYER LLC",
        },
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        status: 200,
      },
    },
    {
      description: "an Intake request for an unknown taxpayer identifier status",
      providerStates: [{ name: "TIVS does not know the taxpayer identifier" }],
      request: {
        body: {
          clientId: "client-synthetic-002",
          taxpayerId: "000001234",
          taxpayerIdType: "EIN",
        },
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": "pact-correlation-id",
        },
        method: "POST",
        path: "/v1/taxpayer-status",
      },
      response: {
        body: {
          code: "taxpayer_identifier_not_found",
          message: "Taxpayer identifier was not found by the verification service.",
        },
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        status: 404,
      },
    },
  ],
  metadata: {
    pactSpecification: { version: "3.0.0" },
  },
  provider: { name: "tivs-acl" },
};

async function withHttpServer<T>(app: Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const { port } = server.address() as AddressInfo;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("TIVS ACL Pact provider", () => {
  const fakeClient: TivsClient = {
    async verifyTaxpayer() {
      return {
        matched: true,
        decision: "matched",
        verifiedLegalName: "SYNTHETIC TAXPAYER LLC",
      };
    },
    async getTaxpayerStatus() {
      throw new TaxpayerIdentifierNotFoundError();
    },
  };

  it("verifies the ACL as provider against the capstone consumer pact", async () => {
    const app = await createApp({
      auditSink: () => undefined,
      client: fakeClient,
    });
    const pactPath = path.join(tmpdir(), "taxpulse-api-tivs-acl.json");
    fs.writeFileSync(pactPath, JSON.stringify(pactContract));

    await withHttpServer(app, async (baseUrl) => {
      await new Verifier({
        pactUrls: [pactPath],
        provider: "tivs-acl",
        providerBaseUrl: baseUrl,
        stateHandlers: {
          "TIVS has a matching taxpayer identifier": () => Promise.resolve(),
          "TIVS does not know the taxpayer identifier": () => Promise.resolve(),
        },
      }).verifyProvider();
    });
  }, 30000);

  it("proves the breaker opens after real failure volume, not the first blip", async () => {
    const breaker = createTivsBreaker(async () => {
      throw new Error("synthetic TIVS outage");
    });

    expect(TIVS_BREAKER_OPTIONS.volumeThreshold).toBeGreaterThan(1);

    await expect(breaker.fire()).rejects.toThrow("synthetic TIVS outage");
    expect(breaker.opened).toBe(false);

    for (let index = 1; index < TIVS_BREAKER_OPTIONS.volumeThreshold; index += 1) {
      await expect(breaker.fire()).rejects.toThrow();
    }

    expect(breaker.opened).toBe(true);
  });

  it("redacts taxpayer identifiers to last four digits on audit lines", () => {
    const auditLine = renderAuditLine({
      correlationId: "corr-audit-proof",
      durationMs: 12,
      event: "tivs_acl_call",
      operation: "VerifyTaxpayer",
      outcome: "success",
      request: {
        taxpayerId: "000001234",
        taxpayerIdType: "EIN",
      },
      timestamp: "2026-08-06T00:00:00.000Z",
    });

    expect(auditLine.request).toMatchObject({
      taxpayerId: "***-**-1234",
      taxpayerIdType: "EIN",
    });
  });
});
