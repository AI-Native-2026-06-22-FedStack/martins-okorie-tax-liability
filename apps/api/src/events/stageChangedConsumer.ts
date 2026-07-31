import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type Message,
  type SQSClient
} from "@aws-sdk/client-sqs";
import {
  parseStageChangedCloudEvent,
  type StageChangedCloudEvent
} from "@capstone/shared-schemas";

import { getApiEnv, type ApiEnv } from "../config/env.js";
import { ensureRedisReady, redisClient, setRedisJson } from "../store/queueCache.js";
import { createSqsClient, getAwsEventEndpoint } from "./snsSqsSetup.js";

const DEDUPE_PREFIX = "event-dedupe:stage-changed";
const DEDUPE_TTL_SECONDS = 86_400;
const PROJECTION_PREFIX = "projection:stage-changed-current-stage";
const PROJECTION_TTL_SECONDS = 86_400;

export interface StageChangedConsumerResult {
  deleted: number;
  duplicates: number;
  failed: number;
  processed: number;
  received: number;
}

export interface StageChangedProjection {
  changed_at: string;
  changed_by: string;
  current_stage: StageChangedCloudEvent["data"]["to_stage"];
  event_id: string;
  from_stage: StageChangedCloudEvent["data"]["from_stage"];
  projected_at: string;
  tenant_id: string;
  cycle_id: string;
}

interface SnsEnvelope {
  Message?: unknown;
}

function queueUrlForName(env: ApiEnv = getApiEnv()): string {
  const endpoint = getAwsEventEndpoint(env).replace(/\/$/, "");
  return `${endpoint}/000000000000/${env.STAGE_CHANGED_QUEUE}`;
}

export function parseStageChangedMessageBody(body: string): StageChangedCloudEvent {
  const parsed = JSON.parse(body) as unknown;
  const candidate =
    typeof parsed === "object" &&
    parsed !== null &&
    "Message" in parsed &&
    typeof (parsed as SnsEnvelope).Message === "string"
      ? JSON.parse((parsed as { Message: string }).Message)
      : parsed;

  return parseStageChangedCloudEvent(candidate);
}

function dedupeKey(event: StageChangedCloudEvent): string {
  return `${DEDUPE_PREFIX}:${event.data.tenant_id}:${event.id}`;
}

export function stageChangedProjectionKey(tenantId: string, cycleId: string): string {
  return `${PROJECTION_PREFIX}:${tenantId}:${cycleId}`;
}

async function claimEvent(event: StageChangedCloudEvent): Promise<boolean> {
  await ensureRedisReady();
  const claimed = await redisClient.set(
    dedupeKey(event),
    "processing",
    "EX",
    DEDUPE_TTL_SECONDS,
    "NX"
  );
  return claimed === "OK";
}

async function markEventProcessed(event: StageChangedCloudEvent): Promise<void> {
  await redisClient.set(dedupeKey(event), "processed", "EX", DEDUPE_TTL_SECONDS);
}

async function releaseEventClaim(event: StageChangedCloudEvent): Promise<void> {
  await redisClient.del(dedupeKey(event));
}

export async function projectStageChangedEvent(
  event: StageChangedCloudEvent,
  projectedAt: Date = new Date()
): Promise<StageChangedProjection> {
  const projection: StageChangedProjection = {
    changed_at: event.data.changed_at,
    changed_by: event.data.changed_by,
    current_stage: event.data.to_stage,
    cycle_id: event.data.cycle_id,
    event_id: event.id,
    from_stage: event.data.from_stage,
    projected_at: projectedAt.toISOString(),
    tenant_id: event.data.tenant_id
  };

  await setRedisJson(
    stageChangedProjectionKey(event.data.tenant_id, event.data.cycle_id),
    projection,
    PROJECTION_TTL_SECONDS
  );

  return projection;
}

async function deleteMessage(sqs: Pick<SQSClient, "send">, queueUrl: string, message: Message) {
  if (!message.ReceiptHandle) {
    return;
  }

  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle
    })
  );
}

export async function consumeStageChangedOnce({
  env = getApiEnv(),
  handler,
  queueUrl = queueUrlForName(env),
  sqs = createSqsClient(env)
}: {
  env?: ApiEnv;
  handler?: (event: StageChangedCloudEvent) => Promise<void>;
  queueUrl?: string;
  sqs?: Pick<SQSClient, "send">;
} = {}): Promise<StageChangedConsumerResult> {
  const result: StageChangedConsumerResult = {
    deleted: 0,
    duplicates: 0,
    failed: 0,
    processed: 0,
    received: 0
  };

  const messages = await sqs.send(
    new ReceiveMessageCommand({
      MaxNumberOfMessages: 10,
      QueueUrl: queueUrl,
      WaitTimeSeconds: 5
    })
  );

  for (const message of messages.Messages ?? []) {
    result.received += 1;
    let event: StageChangedCloudEvent | undefined;

    try {
      if (!message.Body) {
        throw new Error("SQS message body is empty.");
      }

      event = parseStageChangedMessageBody(message.Body);
      const claimed = await claimEvent(event);
      if (!claimed) {
        result.duplicates += 1;
        await deleteMessage(sqs, queueUrl, message);
        result.deleted += 1;
        continue;
      }

      if (handler) {
        await handler(event);
      } else {
        await projectStageChangedEvent(event);
      }

      await markEventProcessed(event);
      result.processed += 1;
      await deleteMessage(sqs, queueUrl, message);
      result.deleted += 1;
    } catch {
      if (event) {
        await releaseEventClaim(event);
      }
      result.failed += 1;
    }
  }

  return result;
}
