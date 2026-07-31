import {
  CreateTopicCommand,
  PublishCommand,
  SubscribeCommand
} from "@aws-sdk/client-sns";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SetQueueAttributesCommand
} from "@aws-sdk/client-sqs";
import { describe, expect, it, vi } from "vitest";

const redisSet = vi.fn();
const redisDel = vi.fn();
const setRedisJson = vi.fn();

vi.mock("../../src/store/queueCache.js", () => ({
  ensureRedisReady: vi.fn().mockResolvedValue(undefined),
  redisClient: {
    del: redisDel,
    set: redisSet
  },
  setRedisJson
}));

const env = {
  AWS_ENDPOINT: "http://localhost:8000",
  AWS_ENDPOINT_URL: "http://localhost:4566",
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
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
  STAGE_CHANGED_TOPIC: "taxpulse-stage-changed",
  STAGE_CHANGED_QUEUE: "taxpulse-stage-changed-projection",
  STAGE_CHANGED_DLQ: "taxpulse-stage-changed-dlq",
  QUEUE_CACHE_TTL_SECONDS: 60,
  IDEMPOTENCY_TTL_SECONDS: 86400,
  IDEMPOTENCY_LOCK_TTL_MS: 30000
};

describe("SNS/SQS stage-changed fan-out", () => {
  it("creates a topic, queue subscription, and DLQ redrive policy", async () => {
    const { setupStageChangedFanout, STAGE_CHANGED_QUEUE_TYPE } = await import(
      "../../src/events/snsSqsSetup.js"
    );
    const snsSend = vi.fn(async (command) => {
      if (command instanceof CreateTopicCommand) {
        return { TopicArn: "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed" };
      }
      if (command instanceof SubscribeCommand) {
        return { SubscriptionArn: "arn:aws:sns:subscription/stage-changed" };
      }
      return {};
    });
    const sqsSend = vi.fn(async (command) => {
      if (command instanceof CreateQueueCommand) {
        const input = command.input as { QueueName: string };
        return { QueueUrl: `http://localhost:4566/000000000000/${input.QueueName}` };
      }
      if (command instanceof GetQueueAttributesCommand) {
        const input = command.input as { QueueUrl: string };
        return {
          Attributes: {
            QueueArn: input.QueueUrl.endsWith("dlq")
              ? "arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-dlq"
              : "arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-projection"
          }
        };
      }
      return {};
    });

    const resources = await setupStageChangedFanout({
      env,
      sns: { send: snsSend } as never,
      sqs: { send: sqsSend } as never
    });

    expect(resources.topicArn).toContain("taxpulse-stage-changed");
    expect(STAGE_CHANGED_QUEUE_TYPE).toBe("standard");
    expect(snsSend).toHaveBeenCalledWith(expect.any(CreateTopicCommand));
    expect(snsSend).toHaveBeenCalledWith(expect.any(SubscribeCommand));
    expect(sqsSend).toHaveBeenCalledWith(expect.any(SetQueueAttributesCommand));

    const queueCreate = sqsSend.mock.calls
      .map(([command]) => command)
      .find(
        (command) =>
          command instanceof CreateQueueCommand &&
          command.input.QueueName === "taxpulse-stage-changed-projection"
      ) as CreateQueueCommand;
    expect(queueCreate.input.Attributes?.RedrivePolicy).toContain("maxReceiveCount");
    expect(queueCreate.input.QueueName).not.toMatch(/\.fifo$/);

    const setAttributes = sqsSend.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof SetQueueAttributesCommand) as SetQueueAttributesCommand;
    expect(setAttributes.input.Attributes?.RedrivePolicy).toContain(
      "arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-dlq"
    );
    expect(setAttributes.input.Attributes?.Policy).toContain("sns.amazonaws.com");
  });

  it("publishes a validated CloudEvent to SNS", async () => {
    const { publishStageChanged } = await import("../../src/events/publishStageChanged.js");
    const send = vi.fn().mockResolvedValue({});

    const event = await publishStageChanged(
      {
        actor: "advisor@taxpulse.test",
        changedAt: new Date("2026-07-31T04:00:00.000Z"),
        cycleId: "22222222-2222-4222-8222-222222222222",
        fromStage: "Intake",
        tenantId: "33333333-3333-4333-8333-333333333333",
        toStage: "Data Aggregation"
      },
      { env, sns: { send } }
    );

    expect(event.specversion).toBe("1.0");
    expect(send).toHaveBeenCalledWith(expect.any(PublishCommand));
    const command = send.mock.calls[0][0] as PublishCommand;
    expect(command.input.TopicArn).toBe(
      "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    );
  });

  it("projects a received event exactly once and deletes replayed duplicates", async () => {
    const { buildStageChangedCloudEvent } = await import(
      "../../src/events/publishStageChanged.js"
    );
    const { consumeStageChangedOnce } = await import("../../src/events/stageChangedConsumer.js");
    const event = buildStageChangedCloudEvent({
      actor: "advisor@taxpulse.test",
      changedAt: new Date("2026-07-31T04:00:00.000Z"),
      cycleId: "22222222-2222-4222-8222-222222222222",
      fromStage: "Intake",
      tenantId: "33333333-3333-4333-8333-333333333333",
      toStage: "Data Aggregation"
    });
    const sqsSend = vi
      .fn()
      .mockResolvedValueOnce({
        Messages: [
          {
            Body: JSON.stringify(event),
            ReceiptHandle: "receipt-1"
          },
          {
            Body: JSON.stringify(event),
            ReceiptHandle: "receipt-2"
          }
        ]
      })
      .mockResolvedValue({});
    redisSet.mockReset();
    redisDel.mockReset();
    setRedisJson.mockReset();
    redisSet.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
    setRedisJson.mockResolvedValue(undefined);

    const result = await consumeStageChangedOnce({
      env,
      sqs: { send: sqsSend },
      queueUrl: "http://localhost:4566/000000000000/taxpulse-stage-changed-projection"
    });

    expect(result).toMatchObject({ deleted: 2, duplicates: 1, processed: 1, received: 2 });
    expect(setRedisJson).toHaveBeenCalledTimes(1);
    expect(setRedisJson.mock.calls[0][0]).toContain(
      "projection:stage-changed-current-stage:33333333-3333-4333-8333-333333333333:22222222-2222-4222-8222-222222222222"
    );
    expect(setRedisJson.mock.calls[0][1]).toMatchObject({
      current_stage: "Data Aggregation",
      event_id: event.id,
      from_stage: "Intake"
    });
    expect(sqsSend).toHaveBeenCalledWith(expect.any(DeleteMessageCommand));
  });

  it("leaves poison messages undeleted so SQS can redrive them to the DLQ", async () => {
    const { consumeStageChangedOnce } = await import("../../src/events/stageChangedConsumer.js");
    const sqsSend = vi.fn(async (command) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [
            {
              Body: JSON.stringify({ type: "not-a-cloudevent" }),
              ReceiptHandle: "poison-receipt"
            }
          ]
        };
      }
      return {};
    });

    redisSet.mockReset();
    redisDel.mockReset();
    setRedisJson.mockReset();

    const result = await consumeStageChangedOnce({
      env,
      handler: vi.fn(),
      sqs: { send: sqsSend },
      queueUrl: "http://localhost:4566/000000000000/taxpulse-stage-changed-projection"
    });

    expect(result).toMatchObject({ deleted: 0, failed: 1, received: 1 });
    expect(redisSet).not.toHaveBeenCalled();
    expect(setRedisJson).not.toHaveBeenCalled();
    expect(sqsSend).not.toHaveBeenCalledWith(expect.any(DeleteMessageCommand));
  });

  it("uses a stable tenant-and-cycle scoped projection key", async () => {
    const { stageChangedProjectionKey } = await import(
      "../../src/events/stageChangedConsumer.js"
    );

    expect(
      stageChangedProjectionKey(
        "33333333-3333-4333-8333-333333333333",
        "22222222-2222-4222-8222-222222222222"
      )
    ).toBe(
      "projection:stage-changed-current-stage:33333333-3333-4333-8333-333333333333:22222222-2222-4222-8222-222222222222"
    );
  });
});
