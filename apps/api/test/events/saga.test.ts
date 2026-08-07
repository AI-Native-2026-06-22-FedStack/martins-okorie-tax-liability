import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { getDb } from "../../src/db/client.js";
import { actionItem, auditEntry, outbox, taxPlanCycle } from "../../src/db/schema.js";
import {
  compensatePresentToClientFailure,
  runPresentToClientSaga
} from "../../src/events/presentToClientSaga.js";
import { makeTaxPlanCycle } from "../factories/make-cycle.js";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

const cycleId = "33333333-3333-4333-8333-333333333333";
const tenantId = "11111111-1111-4111-8111-111111111111";
const actor = "advisor@taxpulse.test";

const actionItems = [
  {
    deadline: "2026-08-14",
    description: "Review synthetic Roth conversion action."
  },
  {
    deadline: "2026-08-21",
    description: "Confirm synthetic estimated payment schedule."
  }
];

async function insertReviewCycle() {
  await getDb()
    .insert(taxPlanCycle)
    .values(
      makeTaxPlanCycle({
        id: cycleId,
        stage: "Review",
        tenant_id: tenantId
      })
    );
}

async function cycleStage() {
  const [cycle] = await getDb()
    .select({ stage: taxPlanCycle.stage })
    .from(taxPlanCycle)
    .where(and(eq(taxPlanCycle.id, cycleId), eq(taxPlanCycle.tenant_id, tenantId)));

  return cycle?.stage;
}

describeWithDatabase("present-to-client saga", () => {
  it("presents the cycle, creates action items, and emits the outbox event", async () => {
    await insertReviewCycle();

    const result = await runPresentToClientSaga({
      actionItems,
      actor,
      cycleId,
      presentedAt: new Date("2026-07-31T10:00:00.000Z"),
      tenantId
    });

    expect(await cycleStage()).toBe("Client Approval");

    const rows = await getDb()
      .select()
      .from(actionItem)
      .where(and(eq(actionItem.case_id, cycleId), eq(actionItem.tenant_id, tenantId)));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id).sort()).toEqual([...result.actionItemIds].sort());
    expect(rows.every((row) => row.completed === false)).toBe(true);

    const [eventRow] = await getDb().select().from(outbox).where(eq(outbox.id, result.event.id));
    expect(eventRow?.event_type).toBe("com.taxpulse.tax-plan-cycle.presented-to-client.v1");
    expect(eventRow?.sent_at).toBeNull();
    expect(eventRow?.payload).toMatchObject({
      id: result.event.id,
      specversion: "1.0",
      type: "com.taxpulse.tax-plan-cycle.presented-to-client.v1"
    });
  });

  it("compensates back to Review when action-item creation fails", async () => {
    await insertReviewCycle();

    await expect(
      runPresentToClientSaga(
        {
          actionItems,
          actor,
          cycleId,
          presentedAt: new Date("2026-07-31T11:00:00.000Z"),
          tenantId
        },
        {
          createActionItems: vi.fn().mockRejectedValue(new Error("synthetic action item outage")),
          now: () => new Date("2026-07-31T11:00:00.000Z")
        }
      )
    ).rejects.toThrow("synthetic action item outage");

    expect(await cycleStage()).toBe("Review");

    const rows = await getDb()
      .select()
      .from(actionItem)
      .where(and(eq(actionItem.case_id, cycleId), eq(actionItem.tenant_id, tenantId)));
    expect(rows).toHaveLength(0);

    const eventRows = await getDb()
      .select()
      .from(outbox)
      .where(eq(outbox.event_type, "com.taxpulse.tax-plan-cycle.presented-to-client.v1"));
    expect(eventRows).toHaveLength(0);

    const compensationRows = await getDb()
      .select()
      .from(auditEntry)
      .where(
        and(
          eq(auditEntry.case_id, cycleId),
          eq(auditEntry.tenant_id, tenantId),
          eq(auditEntry.action, "cycle.present-to-client.compensated")
        )
      );
    expect(compensationRows).toHaveLength(1);
    expect(compensationRows[0]?.reason).toContain("synthetic action item outage");

    await compensatePresentToClientFailure({
      actor,
      cycleId,
      reason: "retry should be a no-op",
      tenantId
    });

    expect(await cycleStage()).toBe("Review");
    const compensationRowsAfterRetry = await getDb()
      .select()
      .from(auditEntry)
      .where(
        and(
          eq(auditEntry.case_id, cycleId),
          eq(auditEntry.tenant_id, tenantId),
          eq(auditEntry.action, "cycle.present-to-client.compensated")
        )
      );
    expect(compensationRowsAfterRetry).toHaveLength(1);
  });
});
