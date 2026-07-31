import { randomUUID } from "node:crypto";
import { PublishCommand, type SNSClient } from "@aws-sdk/client-sns";
import {
  parseStageChangedCloudEvent,
  stageChangedEventSource,
  stageChangedEventType,
  type StageChangedCloudEvent
} from "@capstone/shared-schemas";

import { getApiEnv, type ApiEnv } from "../config/env.js";
import type { TaxPlanCycleStage } from "../db/schema.js";
import { createSnsClient } from "./snsSqsSetup.js";

export interface StageChangedInput {
  actor: string;
  changedAt?: Date;
  cycleId: string;
  fromStage: TaxPlanCycleStage | null;
  tenantId: string;
  toStage: TaxPlanCycleStage;
}

export function buildStageChangedCloudEvent(input: StageChangedInput): StageChangedCloudEvent {
  const changedAt = input.changedAt ?? new Date();
  const changedAtIso = changedAt.toISOString();

  return parseStageChangedCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source: stageChangedEventSource,
    type: stageChangedEventType,
    time: changedAtIso,
    subject: `tax-plan-cycle/${input.cycleId}`,
    datacontenttype: "application/json",
    data: {
      tenant_id: input.tenantId,
      cycle_id: input.cycleId,
      from_stage: input.fromStage,
      to_stage: input.toStage,
      changed_by: input.actor,
      changed_at: changedAtIso
    }
  });
}

export async function publishStageChanged(
  input: StageChangedInput,
  {
    env = getApiEnv(),
    sns = createSnsClient(env),
    topicArn
  }: {
    env?: ApiEnv;
    sns?: Pick<SNSClient, "send">;
    topicArn?: string;
  } = {}
): Promise<StageChangedCloudEvent> {
  const event = buildStageChangedCloudEvent(input);

  await sns.send(
    new PublishCommand({
      Message: JSON.stringify(event),
      TopicArn:
        topicArn ??
        `arn:aws:sns:${env.AWS_REGION}:000000000000:${env.STAGE_CHANGED_TOPIC}`
    })
  );

  return event;
}
