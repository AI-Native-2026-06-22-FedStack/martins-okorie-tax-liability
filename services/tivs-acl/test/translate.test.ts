import { describe, expect, it } from "vitest";
import { TaxpayerIdentifierNotFoundError } from "../src/acl/dto.js";
import {
  toTaxpayerComplianceStatus,
  toTivsDomainError,
  toVerificationResult,
} from "../src/acl/translate.js";

describe("TIVS ACL translation", () => {
  it("maps the numeric-string match code into a TaxPulse verification result", () => {
    expect(toVerificationResult({ MatchCode: "0", VerifiedName: "SYNTHETIC TAXPAYER LLC" })).toEqual({
      matched: true,
      decision: "matched",
      verifiedLegalName: "SYNTHETIC TAXPAYER LLC",
    });

    expect(toVerificationResult({ MatchCode: "2" })).toEqual({
      matched: false,
      decision: "not_found",
    });
  });

  it("maps legacy standing and MMDDYYYY date into a TaxPulse status DTO", () => {
    expect(toTaxpayerComplianceStatus({ Standing: "ACTIVE", AsOfDate: "07132026" })).toEqual({
      complianceStatus: "active",
      effectiveOn: new Date(Date.UTC(2026, 6, 13)),
    });
  });

  it("maps TaxpayerNotFoundFault into the same typed not-found concept", () => {
    const domainError = toTivsDomainError(new Error("TaxpayerNotFoundFault: identifier not found"));

    expect(domainError).toBeInstanceOf(TaxpayerIdentifierNotFoundError);
    expect((domainError as TaxpayerIdentifierNotFoundError).code).toBe("taxpayer_identifier_not_found");
  });
});
