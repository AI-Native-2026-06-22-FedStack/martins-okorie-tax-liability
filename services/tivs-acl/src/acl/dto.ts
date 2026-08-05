export type TaxpayerIdType = "EIN" | "SSN";

export type TaxpayerVerificationStatus = "match" | "name_mismatch" | "not_found" | "unknown";

export interface TaxpayerVerificationRequest {
  taxpayerId: string;
  taxpayerIdType: TaxpayerIdType;
  legalName: string;
}

export interface TaxpayerVerification {
  status: TaxpayerVerificationStatus;
  matchCode: string;
  verified: boolean;
  taxpayerIdType: TaxpayerIdType | "unknown";
  verifiedName?: string;
}

export interface TaxpayerStatusRequest {
  taxpayerId: string;
  taxpayerIdType: TaxpayerIdType;
}

export interface TaxpayerStatus {
  standing: "active" | "inactive" | "suspended" | "unknown";
  asOfDate: string;
}

export class TaxpayerNotFoundError extends Error {
  constructor() {
    super("Taxpayer was not found by the verification service.");
    this.name = "TaxpayerNotFoundError";
  }
}

export class TivsAuthenticationError extends Error {
  constructor() {
    super("Taxpayer verification service authentication failed.");
    this.name = "TivsAuthenticationError";
  }
}

export class TivsUnavailableError extends Error {
  constructor(message = "Taxpayer verification service is unavailable.") {
    super(message);
    this.name = "TivsUnavailableError";
  }
}
