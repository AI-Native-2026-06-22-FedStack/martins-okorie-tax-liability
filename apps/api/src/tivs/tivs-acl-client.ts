export type TaxpayerIdType = "EIN" | "SSN";

export type VerificationDecision = "matched" | "not_issued" | "not_found" | "name_mismatch" | "unrecognized";

export interface TaxpayerVerificationResult {
  matched: boolean;
  decision: VerificationDecision;
  verifiedLegalName?: string;
}

export interface TivsAclVerifyRequest {
  taxpayerId: string;
  taxpayerIdType: TaxpayerIdType;
  legalName: string;
}

export class TivsAclDomainError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "TivsAclDomainError";
  }
}

export class TivsAclClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.TIVS_ACL_BASE_URL ?? "http://127.0.0.1:4300").replace(
      /\/$/,
      ""
    );
  }

  async verifyTaxpayer(
    request: TivsAclVerifyRequest,
    correlationId: string
  ): Promise<TaxpayerVerificationResult> {
    const response = await fetch(`${this.baseUrl}/v1/taxpayer-verifications`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId
      },
      body: JSON.stringify(request)
    });

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (response.ok) {
      return body as unknown as TaxpayerVerificationResult;
    }

    if (typeof body.code === "string" && typeof body.message === "string") {
      throw new TivsAclDomainError(body.message, body.code);
    }

    throw new TivsAclDomainError("TIVS ACL unavailable.", "tivs_acl_unavailable");
  }
}
