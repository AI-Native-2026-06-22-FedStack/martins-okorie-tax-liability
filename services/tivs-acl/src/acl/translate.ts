import {
  TaxpayerIdType,
  TaxpayerNotFoundError,
  TaxpayerStatus,
  TaxpayerVerification,
  TivsAuthenticationError,
  TivsUnavailableError,
} from "./dto.js";

interface TivsVerifySoapResponse {
  MatchCode?: string | number;
  TINType?: string;
  VerifiedName?: string;
}

interface TivsStatusSoapResponse {
  Standing?: string;
  AsOfDate?: string;
}

export function translateVerification(response: TivsVerifySoapResponse): TaxpayerVerification {
  const matchCode = String(response.MatchCode ?? "unknown");
  const taxpayerIdType: TaxpayerIdType | "unknown" =
    response.TINType === "EIN" || response.TINType === "SSN" ? response.TINType : "unknown";
  const base = {
    matchCode,
    taxpayerIdType,
    verified: false,
    ...(response.VerifiedName ? { verifiedName: response.VerifiedName } : {}),
  } satisfies Omit<TaxpayerVerification, "status">;

  switch (matchCode) {
    case "0":
      return { ...base, status: "match", verified: true };
    case "2":
      return { ...base, status: "not_found" };
    case "3":
      return { ...base, status: "name_mismatch" };
    default:
      return { ...base, status: "unknown" };
  }
}

export function translateTaxpayerStatus(response: TivsStatusSoapResponse): TaxpayerStatus {
  const standing = response.Standing?.toUpperCase();
  const base = { asOfDate: response.AsOfDate ?? "" };

  if (standing === "ACTIVE") {
    return { ...base, standing: "active" };
  }

  if (standing === "INACTIVE") {
    return { ...base, standing: "inactive" };
  }

  if (standing === "SUSPENDED") {
    return { ...base, standing: "suspended" };
  }

  return { ...base, standing: "unknown" };
}

export function translateSoapFault(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (/TaxpayerNotFoundFault|not found/i.test(message)) {
    return new TaxpayerNotFoundError();
  }

  if (/Authentication failed|UsernameToken|security/i.test(message)) {
    return new TivsAuthenticationError();
  }

  return new TivsUnavailableError();
}
