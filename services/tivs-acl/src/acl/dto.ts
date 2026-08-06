export type TaxpayerIdType = "EIN" | "SSN";

export type VerificationDecision = "matched" | "not_issued" | "not_found" | "name_mismatch" | "unrecognized";

export interface TaxpayerVerificationRequest {
  taxpayerId: string;
  taxpayerIdType: TaxpayerIdType;
  legalName: string;
}

export interface TaxpayerVerificationResult {
  matched: boolean;
  decision: VerificationDecision;
  verifiedLegalName?: string;
}

export interface TaxpayerStatusRequest {
  taxpayerId: string;
  taxpayerIdType: TaxpayerIdType;
}

export type TaxpayerComplianceStatus = "active" | "inactive" | "suspended" | "unknown";

export interface TaxpayerComplianceStatusResult {
  complianceStatus: TaxpayerComplianceStatus;
  effectiveOn: Date;
}

export class TivsDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "TivsDomainError";
  }
}

export class TaxpayerIdentifierNotFoundError extends TivsDomainError {
  constructor() {
    super("Taxpayer identifier was not found by the verification service.", "taxpayer_identifier_not_found");
    this.name = "TaxpayerIdentifierNotFoundError";
  }
}

export class TivsAuthenticationError extends TivsDomainError {
  constructor() {
    super("Taxpayer verification service authentication failed.", "tivs_authentication_failed");
    this.name = "TivsAuthenticationError";
  }
}

export class TivsUnavailableError extends TivsDomainError {
  constructor(message = "Taxpayer verification service is unavailable.") {
    super(message, "tivs_unavailable");
    this.name = "TivsUnavailableError";
  }
}
