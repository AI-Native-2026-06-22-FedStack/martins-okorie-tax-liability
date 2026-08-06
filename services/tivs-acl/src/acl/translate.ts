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

export function translateVerification(response: unknown): TaxpayerVerification {
  const soapResponse = response as TivsVerifySoapResponse;
  const matchCode = String(soapResponse.MatchCode ?? "unknown");
  const taxpayerIdType: TaxpayerIdType | "unknown" =
    soapResponse.TINType === "EIN" || soapResponse.TINType === "SSN" ? soapResponse.TINType : "unknown";
  const base = {
    matchCode,
    taxpayerIdType,
    verified: false,
    ...(soapResponse.VerifiedName ? { verifiedName: soapResponse.VerifiedName } : {}),
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

export function translateTaxpayerStatus(response: unknown): TaxpayerStatus {
  const soapResponse = response as TivsStatusSoapResponse;
  const standing = soapResponse.Standing?.toUpperCase();
  const base = { asOfDate: soapResponse.AsOfDate ?? "" };

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
