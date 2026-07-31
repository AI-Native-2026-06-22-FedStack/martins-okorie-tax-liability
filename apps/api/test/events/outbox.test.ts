import { eq, isNull } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { getDb } from "../../src/db/client.js";
import { outbox, taxPlanCycle } from "../../src/db/schema.js";
import { buildStageChangedCloudEvent } from "../../src/events/publishStageChanged.js";
import { publishOutboxBatch } from "../../src/events/outboxRelay.js";
import { insertStageChangedOutboxEvent } from "../../src/repository/outbox.repository.js";
import { makeTaxPlanCycle } from "../factories/make-cycle.js";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

function makeStageChangedEvent() {
  return buildStageChangedCloudEvent({
    actor: "advisor@taxpulse.test",
    changedAt: new Date("2026-07-31T04:00:00.000Z"),
    cycleId: "22222222-2222-4222-8222-222222222222",
    fromStage: "Intake",
    tenantId: "11111111-1111-4111-8111-111111111111",
    toStage: "Data Aggregation"
  });
}

async function outboxRows() {
  return getDb().select().from(outbox).orderBy(outbox.created_at, outbox.id);
}

describeWithDatabase("outbox pattern for stage-changed events", () => {
  it("rolls back the outbox row with the transition transaction", async () => {
    const db = getDb();
    const cycle = makeTaxPlanCycle({ id: "22222222-2222-4222-8222-222222222222" });
    await db.insert(taxPlanCycle).values(cycle);
    const event = makeStageChangedEvent();

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(taxPlanCycle)
          .set({ stage: "Data Aggregation" })
          .where(eq(taxPlanCycle.id, cycle.id));
        await insertStageChangedOutboxEvent(event, tx);
        throw new Error("simulate transition rollback");
      })
    ).rejects.toThrow("simulate transition rollback");

    const rows = await outboxRows();
    expect(rows).toHaveLength(0);

    const [unchanged] = await db.select().from(taxPlanCycle).where(eq(taxPlanCycle.id, cycle.id));
    expect(unchanged?.stage).toBe("Intake");
  });

  it("leaves a committed outbox row for the relay to publish after a crash before relay startup", async () => {
    const db = getDb();
    const event = makeStageChangedEvent();
    await insertStageChangedOutboxEvent(event, db);

    let [pending] = await db.select().from(outbox).where(eq(outbox.id, event.id));
    expect(pending?.sent_at).toBeNull();

    const send = vi.fn().mockResolvedValue({});
    const result = await publishOutboxBatch({
      backoffMs: 0,
      db,
      maxPublishAttempts: 1,
      sns: { send },
      topicArn: "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    });

    expect(result).toEqual({ claimed: 1, failed: 0, published: 1 });
    expect(send).toHaveBeenCalledTimes(1);

    [pending] = await db.select().from(outbox).where(eq(outbox.id, event.id));
    expect(pending?.sent_at).toBeInstanceOf(Date);
    expect(pending?.claimed_at).toBeNull();
  });

  it("does not mark sent on transient publish failure and retries on a later relay run", async () => {
    const db = getDb();
    const event = makeStageChangedEvent();
    await insertStageChangedOutboxEvent(event, db);

    const failedSend = vi.fn().mockRejectedValueOnce(new Error("synthetic SNS outage"));
    const failed = await publishOutboxBatch({
      backoffMs: 0,
      db,
      maxPublishAttempts: 1,
      sns: { send: failedSend },
      topicArn: "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    });

    expect(failed).toEqual({ claimed: 1, failed: 1, published: 0 });

    let [pending] = await db.select().from(outbox).where(eq(outbox.id, event.id));
    expect(pending?.sent_at).toBeNull();
    expect(pending?.claimed_at).toBeNull();
    expect(pending?.attempts).toBe(1);
    expect(pending?.last_error).toContain("synthetic SNS outage");

    const successfulSend = vi.fn().mockResolvedValue({});
    const retried = await publishOutboxBatch({
      backoffMs: 0,
      db,
      maxPublishAttempts: 1,
      sns: { send: successfulSend },
      topicArn: "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    });

    expect(retried).toEqual({ claimed: 1, failed: 0, published: 1 });
    expect(successfulSend).toHaveBeenCalledTimes(1);

    [pending] = await db.select().from(outbox).where(eq(outbox.id, event.id));
    expect(pending?.sent_at).toBeInstanceOf(Date);
    expect(pending?.attempts).toBe(2);
    expect(pending?.last_error).toBeNull();
  });

  it("does not claim rows already sent", async () => {
    const db = getDb();
    const event = makeStageChangedEvent();
    await insertStageChangedOutboxEvent(event, db);

    await publishOutboxBatch({
      backoffMs: 0,
      db,
      maxPublishAttempts: 1,
      sns: { send: vi.fn().mockResolvedValue({}) },
      topicArn: "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    });

    const send = vi.fn().mockResolvedValue({});
    const secondRun = await publishOutboxBatch({
      backoffMs: 0,
      db,
      maxPublishAttempts: 1,
      sns: { send },
      topicArn: "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    });

    expect(secondRun).toEqual({ claimed: 0, failed: 0, published: 0 });
    expect(send).not.toHaveBeenCalled();

    const unsent = await db.select().from(outbox).where(isNull(outbox.sent_at));
    expect(unsent).toHaveLength(0);
  });
});
