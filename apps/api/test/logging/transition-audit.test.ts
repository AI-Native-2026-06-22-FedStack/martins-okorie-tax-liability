import { and, eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { app } from "../../src/app.js";
import { AuditEntrySchema } from "../../src/audit/audit-entry.schema.js";
import { renderAuditEntry } from "../../src/audit/audit-render.js";
import { signAccessToken } from "../../src/auth/tokens.js";
import { getDb } from "../../src/db/client.js";
import { auditEntry, taxPlanCycle } from "../../src/db/schema.js";
import { makeTaxPlanCycle } from "../factories/make-cycle.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ADVISOR_PAYLOAD = { sub: "advisor@taxpulse.com", tenant_id: TENANT_ID, role: "Advisor" };
const ADMIN_PAYLOAD = { sub: "admin@taxpulse.com", tenant_id: TENANT_ID, role: "Firm Admin" };

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

describe("Audit Logging Schema - Zod Parsing", () => {
  it("successfully parses a complete, valid five-field audit entry", () => {
    const validEntry = {
      actor: "user@taxpulse.com",
      action: "cycle.transition.success",
      timestamp: new Date().toISOString(),
      reason: "Quarterly review submitted",
      result: "success"
    };

    const parsed = AuditEntrySchema.parse(validEntry);
    expect(parsed.actor).toBe(validEntry.actor);
    expect(parsed.result).toBe("success");
  });

  it("fails to parse when the result field is missing", () => {
    const invalidEntry = {
      actor: "user@taxpulse.com",
      action: "cycle.transition.success",
      timestamp: new Date().toISOString(),
      reason: "Quarterly review submitted"
      // result is missing
    };

    expect(() => AuditEntrySchema.parse(invalidEntry)).toThrow(z.ZodError);
  });
});

describe("Audit Log Rendering Censor", () => {
  it("censors dollar figures and numbers in string fields but leaves other text untouched", () => {
    const entry = {
      actor: "advisor@taxpulse.com",
      action: "cycle.transition.success: income = 150000.50, deductions = 30000",
      timestamp: "2026-06-16T14:03:00.000Z",
      reason: "Client requests modeled scenario 2 where income is 250000 and deductions are 50000",
      result: "success"
    };

    const rendered = renderAuditEntry(entry);
    // Timestamps should remain unchanged
    expect(rendered.timestamp).toBe(entry.timestamp);
    // Dollar amounts inside strings should be censored
    expect(rendered.action).toBe("cycle.transition.success: income = [REDACTED], deductions = [REDACTED]");
    expect(rendered.reason).toBe(
      "Client requests modeled scenario [REDACTED] where income is [REDACTED] and deductions are [REDACTED]"
    );
  });
});

describeWithDatabase("PATCH /cycles/:id/transition - Audit Trail & Authorization", () => {
  it("allows Advisor to perform valid advisor transitions, updates cycle stage, and writes exactly 1 success audit entry", async () => {
    const db = getDb();
    const cycleRow = makeTaxPlanCycle({ stage: "Intake", tenant_id: TENANT_ID });
    await db.insert(taxPlanCycle).values(cycleRow);

    const token = signAccessToken(ADVISOR_PAYLOAD);

    const initialAuditCount = await db
      .select()
      .from(auditEntry)
      .where(eq(auditEntry.case_id, cycleRow.id));
    expect(initialAuditCount.length).toBe(0);

    const res = await request(app)
      .patch(`/v1/cycles/${cycleRow.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        toStage: "Data Aggregation",
        reason: "Moving from Intake to Data Aggregation"
      });

    expect(res.status).toBe(200);

    // Verify stage mutation
    const [updatedCycle] = await db
      .select()
      .from(taxPlanCycle)
      .where(and(eq(taxPlanCycle.tenant_id, TENANT_ID), eq(taxPlanCycle.id, cycleRow.id)));
    expect(updatedCycle.stage).toBe("Data Aggregation");

    // Verify audit entry in same transaction
    const audits = await db
      .select()
      .from(auditEntry)
      .where(eq(auditEntry.case_id, cycleRow.id));
    expect(audits.length).toBe(1);
    expect(audits[0].actor).toBe(ADVISOR_PAYLOAD.sub);
    expect(audits[0].result).toBe("success");
    expect(audits[0].action).toContain("cycle.transition.success");
  });

  it("denies Advisor attempting transition requiring Firm Admin, returns 403, does not mutate cycle, and writes failure audit entry", async () => {
    const db = getDb();
    const cycleRow = makeTaxPlanCycle({ stage: "Review", tenant_id: TENANT_ID });
    await db.insert(taxPlanCycle).values(cycleRow);

    const token = signAccessToken(ADVISOR_PAYLOAD);

    const res = await request(app)
      .patch(`/v1/cycles/${cycleRow.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        toStage: "Client Approval", // Firm Admin permission required to sign off Review
        reason: "Signing off Review"
      });

    expect(res.status).toBe(403);

    // Verify stage NOT mutated
    const [updatedCycle] = await db
      .select()
      .from(taxPlanCycle)
      .where(and(eq(taxPlanCycle.tenant_id, TENANT_ID), eq(taxPlanCycle.id, cycleRow.id)));
    expect(updatedCycle.stage).toBe("Review");

    // Verify audit failure logged
    const audits = await db
      .select()
      .from(auditEntry)
      .where(eq(auditEntry.case_id, cycleRow.id));
    expect(audits.length).toBe(1);
    expect(audits[0].actor).toBe(ADVISOR_PAYLOAD.sub);
    expect(audits[0].result).toBe("failure");
    expect(audits[0].action).toContain("cycle.transition.denied");
    expect(audits[0].action).toContain("(unauthorized)");
  });

  it("denies illegal transition, returns 422, does not mutate cycle, and writes failure audit entry", async () => {
    const db = getDb();
    const cycleRow = makeTaxPlanCycle({ stage: "Intake", tenant_id: TENANT_ID });
    await db.insert(taxPlanCycle).values(cycleRow);

    const token = signAccessToken(ADVISOR_PAYLOAD);

    const res = await request(app)
      .patch(`/v1/cycles/${cycleRow.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        toStage: "Review", // Illegal transition from Intake -> Review directly
        reason: "Skip steps"
      });

    expect(res.status).toBe(422);

    // Verify stage NOT mutated
    const [updatedCycle] = await db
      .select()
      .from(taxPlanCycle)
      .where(and(eq(taxPlanCycle.tenant_id, TENANT_ID), eq(taxPlanCycle.id, cycleRow.id)));
    expect(updatedCycle.stage).toBe("Intake");

    // Verify audit failure logged
    const audits = await db
      .select()
      .from(auditEntry)
      .where(eq(auditEntry.case_id, cycleRow.id));
    expect(audits.length).toBe(1);
    expect(audits[0].actor).toBe(ADVISOR_PAYLOAD.sub);
    expect(audits[0].result).toBe("failure");
    expect(audits[0].action).toContain("cycle.transition.denied");
  });

  it("allows Firm Admin to perform administrative Review stage transitions", async () => {
    const db = getDb();
    const cycleRow = makeTaxPlanCycle({ stage: "Review", tenant_id: TENANT_ID });
    await db.insert(taxPlanCycle).values(cycleRow);

    const token = signAccessToken(ADMIN_PAYLOAD);

    const res = await request(app)
      .patch(`/v1/cycles/${cycleRow.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        toStage: "Client Approval", // Firm Admin allowed
        reason: "Review approved by admin"
      });

    expect(res.status).toBe(200);

    const [updatedCycle] = await db
      .select()
      .from(taxPlanCycle)
      .where(and(eq(taxPlanCycle.tenant_id, TENANT_ID), eq(taxPlanCycle.id, cycleRow.id)));
    expect(updatedCycle.stage).toBe("Client Approval");
  });
});

describeWithDatabase("Append-Only Database Mutation Constraints", () => {
  it("blocks and rejects any attempted UPDATE or DELETE queries on the audit_entry table", async () => {
    const db = getDb();
    const cycleRow = makeTaxPlanCycle({ stage: "Intake", tenant_id: TENANT_ID });
    await db.insert(taxPlanCycle).values(cycleRow);

    // 1. Insert an audit entry directly
    const [entry] = await db
      .insert(auditEntry)
      .values({
        tenant_id: TENANT_ID,
        case_id: cycleRow.id,
        actor: "system@taxpulse.com",
        action: "cycle.created",
        reason: "Initial create log",
        result: "success"
      })
      .returning({ id: auditEntry.id });

    expect(entry.id).toBeDefined();

    // 2. Attempting to update should throw an error raising the DB trigger exception
    // We enforce append-only via DB triggers so mutations are rejected by Postgres engine.
    await expect(
      db
        .update(auditEntry)
        .set({ reason: "Malicious update attempt" })
        .where(eq(auditEntry.id, entry.id))
    ).rejects.toThrow();

    // 3. Attempting to delete should also throw an error
    await expect(
      db
        .delete(auditEntry)
        .where(eq(auditEntry.id, entry.id))
    ).rejects.toThrow();
  });
});
