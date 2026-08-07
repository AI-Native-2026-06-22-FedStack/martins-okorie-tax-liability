import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  TaxpayerComplianceStatusResult,
  TaxpayerVerificationResult,
  TivsDomainError,
} from "../src/acl/dto.js";
import { toTaxpayerComplianceStatus, toTivsDomainError, toVerificationResult } from "../src/acl/translate.js";
import type { TivsClient } from "../src/soap/tivsClient.js";

const aclFacingFiles = ["src/acl/dto.ts", "src/server.ts"];

describe("SOAP type boundary", () => {
  afterEach(() => {
    vi.doUnmock("soap");
    vi.resetModules();
    delete process.env.TIVS_WSDL_URL;
    delete process.env.TIVS_ENDPOINT_URL;
    delete process.env.TIVS_USERNAME;
    delete process.env.TIVS_PASSWORD;
  });

  it("keeps SOAP-shaped types out of ACL-facing DTO and REST signatures", () => {
    for (const relativePath of aclFacingFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

      expect(source).not.toMatch(/\bVerifyTaxpayer(Result|Response|Request)\b/);
      expect(source).not.toMatch(/\bGetTaxpayerStatus(Response|Request)\b/);
      expect(source).not.toMatch(/\bTIN(Type)?\b/);
    }
  });

  it("keeps public translator and client returns on capstone DTO/domain-error types", () => {
    expectTypeOf(toVerificationResult).returns.toEqualTypeOf<TaxpayerVerificationResult>();
    expectTypeOf(toTaxpayerComplianceStatus).returns.toEqualTypeOf<TaxpayerComplianceStatusResult>();
    expectTypeOf(toTivsDomainError).returns.toEqualTypeOf<Error>();
    expectTypeOf(new TivsDomainError("synthetic", "synthetic")).toMatchTypeOf<Error>();

    expectTypeOf<Awaited<ReturnType<TivsClient["verifyTaxpayer"]>>>().toEqualTypeOf<TaxpayerVerificationResult>();
    expectTypeOf<Awaited<ReturnType<TivsClient["getTaxpayerStatus"]>>>().toEqualTypeOf<TaxpayerComplianceStatusResult>();
  });

  it("builds the node-soap client from config and calls verification through the narrow interface", async () => {
    const generatedClient = {
      GetTaxpayerStatusAsync: vi.fn(),
      VerifyTaxpayerAsync: vi.fn(async () => [
        { MatchCode: "0", TINType: "EIN", VerifiedName: "SYNTHETIC TAXPAYER LLC" },
      ]),
      setEndpoint: vi.fn(),
      setSecurity: vi.fn(),
    };
    const createClientAsync = vi.fn(async () => generatedClient);
    const WSSecurity = vi.fn(function WSSecurity(
      this: { username: string; password: string },
      username: string,
      password: string,
    ) {
      this.username = username;
      this.password = password;
    });

    vi.doMock("soap", () => ({
      default: {
        createClientAsync,
        WSSecurity,
      },
    }));

    process.env.TIVS_WSDL_URL = "configured-wsdl-url";
    process.env.TIVS_ENDPOINT_URL = "configured-endpoint-url";
    process.env.TIVS_USERNAME = "configured-username";
    process.env.TIVS_PASSWORD = "configured-password";

    const { createTivsClient } = await import("../src/soap/tivsClient.js");
    const client = await createTivsClient();
    const result = await client.verifyTaxpayer("000001234", "EIN", "SYNTHETIC TAXPAYER LLC");

    expect(createClientAsync).toHaveBeenCalledWith("configured-wsdl-url");
    expect(generatedClient.setEndpoint).toHaveBeenCalledWith("configured-endpoint-url");
    expect(generatedClient.setSecurity).toHaveBeenCalledWith(expect.any(WSSecurity));
    expect(generatedClient.VerifyTaxpayerAsync).toHaveBeenCalledWith({
      TIN: "000001234",
      TINType: "EIN",
      LegalName: "SYNTHETIC TAXPAYER LLC",
    });
    expect(result).toEqual({
      matched: true,
      decision: "matched",
      verifiedLegalName: "SYNTHETIC TAXPAYER LLC",
    });
  });
});
