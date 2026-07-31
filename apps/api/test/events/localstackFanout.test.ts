import { randomUUID } from "node:crypto";
import { PublishCommand } from "@aws-sdk/client-sns";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand
} from "@aws-sdk/client-sqs";
import { describe, expect, it } from "vitest";

import { buildStageChangedCloudEvent } from "../../src/events/publishStageChanged.js";
import {
  createSnsClient,
  createSqsClient,
  setupStageChangedFanout
} from "../../src/events/snsSqsSetup.js";

const runLocalStack = process.env.RUN_LOCALSTACK_EVENTS_TESTS === "1";
const describeLocalStack = runLocalStack ? describe : describe.skip;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function receiveOne(sqs: ReturnType<typeof createSqsClient>, queueUrl: string) {
  const response = await sqs.send(
    new ReceiveMessageCommand({
      MaxNumberOfMessages: 1,
      QueueUrl: queueUrl,
      WaitTimeSeconds: 2
    })
  );

  return response.Messages?.[0];
}

async function waitForBodyContaining(
  sqs: ReturnType<typeof createSqsClient>,
  queueUrl: string,
  text: string
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const message = await receiveOne(sqs, queueUrl);
    if (message?.Body?.includes(text)) {
      return message;
    }
    await sleep(1_000);
  }

  return undefined;
}

describeLocalStack("LocalStack SNS/SQS stage-changed fan-out", () => {
  it("publishes a valid event to SQS and redrives poison messages to the DLQ", async () => {
    const suffix = randomUUID().slice(0, 8);
    const env = {
      AWS_ENDPOINT: "http://localhost:8000",
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566",
      AWS_REGION: process.env.AWS_REGION ?? "us-east-1",
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? "test",
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
      PORT: 3000,
      DB_HOST: "localhost",
      DB_PORT: 5433,
      DB_NAME: "taxpulse_l",
      DB_USER: "taxpulse_app",
      DB_SSL: "disable" as const,
      DB_SECRET_ID: "taxpulse/db-password",
      JWT_SECRET_ID: "taxpulse/jwt-signing-keys",
      JWT_ISSUER: "taxpulse-api",
      JWT_AUDIENCE: "taxpulse-clients",
      SECRETS_REFRESH_MS: 300000,
      DDB_ENDPOINT: "http://localhost:8000",
      DDB_TABLE_NAME: "taxpulse-plan-cycle-read-model",
      STAGE_CHANGED_TOPIC: `taxpulse-stage-changed-${suffix}`,
      STAGE_CHANGED_QUEUE: `taxpulse-stage-changed-projection-${suffix}`,
      STAGE_CHANGED_DLQ: `taxpulse-stage-changed-dlq-${suffix}`,
      QUEUE_CACHE_TTL_SECONDS: 60,
      IDEMPOTENCY_TTL_SECONDS: 86400,
      IDEMPOTENCY_LOCK_TTL_MS: 30000
    };
    const sns = createSnsClient(env);
    const sqs = createSqsClient(env);
    const resources = await setupStageChangedFanout({
      env,
      maxReceiveCount: 3,
      sns,
      sqs,
      visibilityTimeoutSeconds: 1
    });
    const event = buildStageChangedCloudEvent({
      actor: "advisor@taxpulse.test",
      changedAt: new Date("2026-07-31T04:00:00.000Z"),
      cycleId: "22222222-2222-4222-8222-222222222222",
      fromStage: "Intake",
      tenantId: "33333333-3333-4333-8333-333333333333",
      toStage: "Data Aggregation"
    });

    await sns.send(
      new PublishCommand({
        Message: JSON.stringify(event),
        TopicArn: resources.topicArn
      })
    );

    const delivered = await receiveOne(sqs, resources.queueUrl);
    expect(delivered?.Body).toBeTruthy();
    expect(JSON.parse(delivered?.Body ?? "{}")).toMatchObject({
      id: event.id,
      type: event.type
    });
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: resources.queueUrl,
        ReceiptHandle: delivered?.ReceiptHandle
      })
    );

    await sqs.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify({ type: "not-a-cloudevent" }),
        QueueUrl: resources.queueUrl
      })
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const poison = await receiveOne(sqs, resources.queueUrl);
      if (poison?.Body) {
        expect(poison.Body).toContain("not-a-cloudevent");
      }
      await sleep(1_100);
    }

    const dlqMessage = await waitForBodyContaining(
      sqs,
      resources.deadLetterQueueUrl,
      "not-a-cloudevent"
    );
    expect(dlqMessage?.Body).toContain("not-a-cloudevent");
  }, 30_000);
});
