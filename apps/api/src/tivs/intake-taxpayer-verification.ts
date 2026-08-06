import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type TaxPulseDb } from "../db/client.js";
import { taxPlanCycle } from "../db/schema.js";
import { NotFoundError } from "../errors/problem-json.js";
import { TivsAclClient, TivsAclDomainError } from "./tivs-acl-client.js";

export interface TivsAclVerificationPort {
  verifyTaxpayer: TivsAclClient["verifyTaxpayer"];
}

export const IntakeTaxpayerVerificationRequestSchema = z.object({
  legalName: z.string().min(1),
  taxpayerId: z.string().min(1),
  taxpayerIdType: z.enum(["EIN", "SSN"])
});

export type IntakeTaxpayerVerificationRequest = z.infer<
  typeof IntakeTaxpayerVerificationRequestSchema
>;

export interface IntakeTaxpayerVerificationResult {
  recorded: true;
  verification: Record<string, unknown>;
}

export async function verifyTaxpayerForIntake(input: {
  actor: string;
  correlationId: string;
  cycleId: string;
  tenantId: string;
  request: IntakeTaxpayerVerificationRequest;
  tivsClient?: TivsAclVerificationPort;
  db?: TaxPulseDb;
}): Promise<IntakeTaxpayerVerificationResult> {
  const db = input.db ?? getDb();
  const [cycle] = await db
    .select()
    .from(taxPlanCycle)
    .where(and(eq(taxPlanCycle.tenant_id, input.tenantId), eq(taxPlanCycle.id, input.cycleId)))
    .limit(1);

  if (!cycle) {
    throw new NotFoundError("Tax Plan Cycle not found.");
  }

  if (cycle.stage !== "Intake") {
    throw new Error("Taxpayer verification is only available during Intake.");
  }

  const tivsClient = input.tivsClient ?? new TivsAclClient();
  const occurredAt = new Date().toISOString();
  let verification: Record<string, unknown>;

  try {
    const result = await tivsClient.verifyTaxpayer(input.request, input.correlationId);
    verification = {
      outcome: "success",
      result,
      verifiedAt: occurredAt,
      verifiedBy: input.actor
    };
  } catch (error) {
    if (!(error instanceof TivsAclDomainError)) {
      throw error;
    }

    verification = {
      error: {
        code: error.code,
        message: error.message
      },
      outcome: "domain_error",
      verifiedAt: occurredAt,
      verifiedBy: input.actor
    };
  }

  await db
    .update(taxPlanCycle)
    .set({
      metadata: {
        ...cycle.metadata,
        taxpayerVerification: verification
      },
      updated_at: new Date()
    })
    .where(and(eq(taxPlanCycle.tenant_id, input.tenantId), eq(taxPlanCycle.id, input.cycleId)));

  return {
    recorded: true,
    verification
  };
}
