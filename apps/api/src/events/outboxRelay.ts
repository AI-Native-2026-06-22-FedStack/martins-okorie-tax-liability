import { PublishCommand, type SNSClient } from "@aws-sdk/client-sns";
import { sql } from "drizzle-orm";

import { getApiEnv, type ApiEnv } from "../config/env.js";
import { getDb, type TaxPulseDb } from "../db/client.js";
import { createSnsClient } from "./snsSqsSetup.js";

export interface ClaimedOutboxEvent {
  id: string;
  payload: unknown;
}

export interface OutboxRelayResult {
  claimed: number;
  failed: number;
  published: number;
}

export interface OutboxRelayOptions {
  backoffMs?: number;
  batchSize?: number;
  db?: TaxPulseDb;
  env?: ApiEnv;
  maxPublishAttempts?: number;
  sns?: Pick<SNSClient, "send">;
  topicArn?: string;
}

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_BACKOFF_MS = 100;
const DEFAULT_MAX_PUBLISH_ATTEMPTS = 3;
const STALE_CLAIM_AFTER_MS = 5 * 60 * 1000;

function outboxRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (typeof result === "object" && result !== null && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }

  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function topicArnForEnv(env: ApiEnv): string {
  return `arn:aws:sns:${env.AWS_REGION}:000000000000:${env.STAGE_CHANGED_TOPIC}`;
}

export async function claimUnsentOutboxEvents(
  db: TaxPulseDb = getDb(),
  batchSize: number = DEFAULT_BATCH_SIZE,
  staleClaimAfterMs: number = STALE_CLAIM_AFTER_MS
): Promise<ClaimedOutboxEvent[]> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql<ClaimedOutboxEvent>`
      WITH claimed AS (
        SELECT id
        FROM outbox
        WHERE sent_at IS NULL
          AND (
            claimed_at IS NULL
            OR claimed_at < ${new Date(Date.now() - staleClaimAfterMs)}
          )
        ORDER BY created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE outbox
      SET claimed_at = now(),
          attempts = attempts + 1,
          last_error = NULL
      FROM claimed
      WHERE outbox.id = claimed.id
      RETURNING outbox.id, outbox.payload
    `);

    return outboxRows<ClaimedOutboxEvent>(result);
  });
}

export async function markOutboxEventSent(
  eventId: string,
  db: TaxPulseDb = getDb()
): Promise<void> {
  await db.execute(sql`
    UPDATE outbox
    SET sent_at = now(),
        claimed_at = NULL,
        last_error = NULL
    WHERE id = ${eventId}
  `);
}

export async function releaseOutboxEventForRetry(
  eventId: string,
  errorMessage: string,
  db: TaxPulseDb = getDb()
): Promise<void> {
  await db.execute(sql`
    UPDATE outbox
    SET claimed_at = NULL,
        last_error = ${errorMessage}
    WHERE id = ${eventId}
      AND sent_at IS NULL
  `);
}

async function publishWithRetry({
  backoffMs,
  maxPublishAttempts,
  message,
  sns,
  topicArn
}: {
  backoffMs: number;
  maxPublishAttempts: number;
  message: string;
  sns: Pick<SNSClient, "send">;
  topicArn: string;
}): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxPublishAttempts; attempt += 1) {
    try {
      await sns.send(new PublishCommand({ Message: message, TopicArn: topicArn }));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxPublishAttempts) {
        await sleep(backoffMs * attempt);
      }
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError ?? "unknown publish error");
  throw new Error(errorMessage);
}

export async function publishOutboxBatch({
  backoffMs = DEFAULT_BACKOFF_MS,
  batchSize = DEFAULT_BATCH_SIZE,
  db = getDb(),
  env = getApiEnv(),
  maxPublishAttempts = DEFAULT_MAX_PUBLISH_ATTEMPTS,
  sns = createSnsClient(env),
  topicArn = topicArnForEnv(env)
}: OutboxRelayOptions = {}): Promise<OutboxRelayResult> {
  const claimed = await claimUnsentOutboxEvents(db, batchSize);
  const result: OutboxRelayResult = {
    claimed: claimed.length,
    failed: 0,
    published: 0
  };

  for (const row of claimed) {
    try {
      await publishWithRetry({
        backoffMs,
        maxPublishAttempts,
        message: JSON.stringify(row.payload),
        sns,
        topicArn
      });
      await markOutboxEventSent(row.id, db);
      result.published += 1;
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await releaseOutboxEventForRetry(row.id, message, db);
    }
  }

  return result;
}
