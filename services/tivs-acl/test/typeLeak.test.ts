import fs from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  TaxpayerComplianceStatusResult,
  TaxpayerVerificationResult,
  TivsDomainError,
} from "../src/acl/dto.js";
import { toTaxpayerComplianceStatus, toTivsDomainError, toVerificationResult } from "../src/acl/translate.js";
import { TivsClient } from "../src/soap/tivsClient.js";

const aclFacingFiles = ["src/acl/dto.ts", "src/server.ts"];

describe("SOAP type boundary", () => {
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
});
