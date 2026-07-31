import { CreateTopicCommand, SNSClient, SubscribeCommand } from "@aws-sdk/client-sns";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SQSClient,
  SetQueueAttributesCommand
} from "@aws-sdk/client-sqs";

import { getApiEnv, type ApiEnv } from "../config/env.js";

export interface StageChangedMessagingResources {
  deadLetterQueueArn: string;
  deadLetterQueueUrl: string;
  queueArn: string;
  queueUrl: string;
  subscriptionArn?: string;
  topicArn: string;
}

export const STAGE_CHANGED_QUEUE_TYPE = "standard";

export function getAwsEventEndpoint(env: ApiEnv = getApiEnv()): string {
  return env.AWS_ENDPOINT_URL ?? env.AWS_ENDPOINT;
}

function eventClientConfig(env: ApiEnv = getApiEnv()) {
  return {
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    },
    endpoint: getAwsEventEndpoint(env),
    region: env.AWS_REGION
  };
}

export function createSnsClient(env: ApiEnv = getApiEnv()): SNSClient {
  return new SNSClient(eventClientConfig(env));
}

export function createSqsClient(env: ApiEnv = getApiEnv()): SQSClient {
  return new SQSClient(eventClientConfig(env));
}

async function getQueueArn(sqs: Pick<SQSClient, "send">, queueUrl: string): Promise<string> {
  const attributes = await sqs.send(
    new GetQueueAttributesCommand({
      AttributeNames: ["QueueArn"],
      QueueUrl: queueUrl
    })
  );

  const queueArn = attributes.Attributes?.QueueArn;
  if (!queueArn) {
    throw new Error(`QueueArn was not returned for ${queueUrl}.`);
  }

  return queueArn;
}

function queuePolicyForTopic(queueArn: string, topicArn: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "sns.amazonaws.com" },
        Action: "sqs:SendMessage",
        Resource: queueArn,
        Condition: {
          ArnEquals: {
            "aws:SourceArn": topicArn
          }
        }
      }
    ]
  });
}

export async function setupStageChangedFanout({
  env = getApiEnv(),
  sns = createSnsClient(env),
  sqs = createSqsClient(env),
  maxReceiveCount = 3,
  visibilityTimeoutSeconds = 30
}: {
  env?: ApiEnv;
  sns?: Pick<SNSClient, "send">;
  sqs?: Pick<SQSClient, "send">;
  maxReceiveCount?: number;
  visibilityTimeoutSeconds?: number;
} = {}): Promise<StageChangedMessagingResources> {
  const topic = await sns.send(new CreateTopicCommand({ Name: env.STAGE_CHANGED_TOPIC }));
  if (!topic.TopicArn) {
    throw new Error(`SNS topic ${env.STAGE_CHANGED_TOPIC} was not created.`);
  }

  const deadLetterQueue = await sqs.send(
    new CreateQueueCommand({ QueueName: env.STAGE_CHANGED_DLQ })
  );
  if (!deadLetterQueue.QueueUrl) {
    throw new Error(`SQS dead-letter queue ${env.STAGE_CHANGED_DLQ} was not created.`);
  }

  const deadLetterQueueArn = await getQueueArn(sqs, deadLetterQueue.QueueUrl);

  const queue = await sqs.send(
    new CreateQueueCommand({
      Attributes: {
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: deadLetterQueueArn,
          maxReceiveCount: String(maxReceiveCount)
        }),
        VisibilityTimeout: String(visibilityTimeoutSeconds)
      },
      QueueName: env.STAGE_CHANGED_QUEUE
    })
  );
  if (!queue.QueueUrl) {
    throw new Error(`SQS queue ${env.STAGE_CHANGED_QUEUE} was not created.`);
  }

  const queueArn = await getQueueArn(sqs, queue.QueueUrl);

  await sqs.send(
    new SetQueueAttributesCommand({
      Attributes: {
        Policy: queuePolicyForTopic(queueArn, topic.TopicArn),
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: deadLetterQueueArn,
          maxReceiveCount: String(maxReceiveCount)
        }),
        VisibilityTimeout: String(visibilityTimeoutSeconds)
      },
      QueueUrl: queue.QueueUrl
    })
  );

  const subscription = await sns.send(
    new SubscribeCommand({
      Attributes: {
        RawMessageDelivery: "true"
      },
      Endpoint: queueArn,
      Protocol: "sqs",
      TopicArn: topic.TopicArn
    })
  );

  return {
    deadLetterQueueArn,
    deadLetterQueueUrl: deadLetterQueue.QueueUrl,
    queueArn,
    queueUrl: queue.QueueUrl,
    subscriptionArn: subscription.SubscriptionArn,
    topicArn: topic.TopicArn
  };
}
