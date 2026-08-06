import {
  TaxpayerIdentifierNotFoundError,
  TaxpayerComplianceStatus,
  TaxpayerComplianceStatusResult,
  TaxpayerVerificationResult,
  TivsAuthenticationError,
  TivsUnavailableError,
} from "./dto.js";

interface VerifyTaxpayerSoapResponse {
  MatchCode?: string | number;
  VerifiedName?: string;
}

interface GetTaxpayerStatusSoapResponse {
  Standing?: string;
  AsOfDate?: string;
}

export function toVerificationResult(response: unknown): TaxpayerVerificationResult {
  const soapResponse = response as VerifyTaxpayerSoapResponse;

  switch (String(soapResponse.MatchCode ?? "")) {
    case "0":
      return {
        matched: true,
        decision: "matched",
        ...(soapResponse.VerifiedName ? { verifiedLegalName: soapResponse.VerifiedName } : {}),
      };
    case "1":
      return { matched: false, decision: "not_issued" };
    case "2":
      return { matched: false, decision: "not_found" };
    case "3":
      return { matched: false, decision: "name_mismatch" };
    default:
      return { matched: false, decision: "unrecognized" };
  }
}

export function toTaxpayerComplianceStatus(response: unknown): TaxpayerComplianceStatusResult {
  const soapResponse = response as GetTaxpayerStatusSoapResponse;

  return {
    complianceStatus: toComplianceStatus(soapResponse.Standing),
    effectiveOn: parseLegacyDate(soapResponse.AsOfDate),
  };
}

export function toTivsDomainError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (/TaxpayerNotFoundFault|not found/i.test(message)) {
    return new TaxpayerIdentifierNotFoundError();
  }

  if (/Authentication failed|UsernameToken|security/i.test(message)) {
    return new TivsAuthenticationError();
  }

  return new TivsUnavailableError();
}

function toComplianceStatus(value: string | undefined): TaxpayerComplianceStatus {
  switch (value?.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "INACTIVE":
      return "inactive";
    case "SUSPENDED":
      return "suspended";
    default:
      return "unknown";
  }
}

function parseLegacyDate(value: string | undefined): Date {
  if (!value || !/^\d{8}$/.test(value)) {
    return new Date(Number.NaN);
  }

  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2, 4));
  const year = Number(value.slice(4, 8));
  return new Date(Date.UTC(year, month - 1, day));
}
