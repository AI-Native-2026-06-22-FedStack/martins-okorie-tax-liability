import { CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";

import { resetApiEnvForTests } from "../../src/config/env.js";
import {
  PLAN_CYCLE_QUEUE_GSI_NAME,
  createDynamoDbClient,
  createDynamoDocumentClient,
  ensurePlanCycleQueueTable
} from "../../src/store/dynamo.js";
import {
  DynamoPlanCycleQueueProjector,
  toPlanCycleQueueItem
} from "../../src/store/dynamo.js";
import { makeTaxPlanCycle } from "../factories/make-cycle.js";

class NotFoundLikeError extends Error {
  readonly name = "ResourceNotFoundException";
}

describe("DynamoDB Plan Cycle Queue read model", () => {
  beforeEach(() => {
    const localAwsEndpoint = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";
    Object.assign(process.env, {
      AWS_ENDPOINT: localAwsEndpoint,
      AWS_ENDPOINT_URL: localAwsEndpoint,
      AWS_REGION: "us-east-1",
      DB_HOST: "localhost",
      DB_NAME: "taxpulse",
      DB_PORT: "5432",
      DB_SECRET_ID: "taxpulse/db-password",
      DB_SSL: "disable",
      DB_USER: "taxpulse_app",
      DDB_ENDPOINT: process.env.DDB_ENDPOINT ?? localAwsEndpoint,
      DDB_TABLE_NAME: "taxpulse-plan-cycle-read-model-test",
      JWT_SECRET_ID: "taxpulse/jwt-signing-keys",
      PORT: "3000"
    });
    resetApiEnvForTests();
  });

  it("creates the single-table read model with on-demand capacity and one GSI", async () => {
    const commands: unknown[] = [];
    const client = {
      async send(command: unknown): Promise<unknown> {
        commands.push(command);
        if (command instanceof DescribeTableCommand) {
          throw new NotFoundLikeError();
        }
        return {};
      }
    };

    await ensurePlanCycleQueueTable(client as never);

    const createTableCommand = commands.find(
      (command): command is CreateTableCommand => command instanceof CreateTableCommand
    );

    expect(createTableCommand).toBeDefined();
    expect(createTableCommand?.input).toMatchObject({
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          IndexName: PLAN_CYCLE_QUEUE_GSI_NAME,
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" }
          ]
        }
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" }
      ]
    });
  });

  it("projects cycle rows and serves base and owner access patterns with QueryCommand only", async () => {
    const sentCommands: unknown[] = [];
    const storedItems: Record<string, Record<string, unknown>> = {};
    const documentClient = {
      async send(command: unknown): Promise<unknown> {
        sentCommands.push(command);
        if (command instanceof QueryCommand) {
          return {
            Items: Object.values(storedItems).filter(
              (item) =>
                item.PK === command.input.ExpressionAttributeValues?.[":pk"] &&
                (command.input.ExpressionAttributeValues?.[":sk"] === undefined ||
                  item.SK === command.input.ExpressionAttributeValues[":sk"] ||
                  String(item.SK).startsWith(
                    String(command.input.ExpressionAttributeValues[":sk"])
                  ))
            )
          };
        }
        if (command instanceof BatchWriteCommand) {
          for (const request of command.input.RequestItems?.["test-table"] ?? []) {
            const item = request.PutRequest?.Item;
            if (item?.PK && item.SK) {
              storedItems[`${item.PK}:${item.SK}`] = item;
            }
            const key = request.DeleteRequest?.Key;
            if (key?.PK && key.SK) {
              delete storedItems[`${key.PK}:${key.SK}`];
            }
          }
        }
        return {};
      }
    };
    const projector = new DynamoPlanCycleQueueProjector(
      documentClient as never,
      "test-table",
      async () => {}
    );
    const cycle = makeTaxPlanCycle({
      due_date: "2026-08-31",
      owner: "Fictional Advisor",
      priority: "P1",
      stage: "Intake"
    });
    const overdueCycle = makeTaxPlanCycle({
      due_date: "2026-01-15",
      id: cycle.id,
      owner: "Fictional Advisor",
      priority: "P1",
      stage: "Review",
      tenant_id: cycle.tenant_id
    });

    await projector.upsertCycle(cycle);
    await projector.deleteCycle(cycle);
    await projector.upsertCycle(overdueCycle);
    await projector.listQueue({ stage: "Intake", tenant_id: cycle.tenant_id });
    await projector.listQueue({
      owner: "Fictional Advisor",
      stage: "Intake",
      tenant_id: cycle.tenant_id
    });
    const readYourOwnWrite = await projector.getCycleById(cycle.tenant_id, cycle.id);
    const overdueRows = await projector.listOverdueByDueDate(cycle.tenant_id);

    expect(sentCommands[0]).toBeInstanceOf(BatchWriteCommand);
    const deleteCommand = sentCommands.find(
      (command): command is BatchWriteCommand =>
        command instanceof BatchWriteCommand &&
        command.input.RequestItems?.["test-table"]?.some((request) => request.DeleteRequest)
    );
    const deleteRequests = deleteCommand?.input.RequestItems?.["test-table"] ?? [];
    expect(
      deleteRequests
        .map((request) => request.DeleteRequest?.Key)
        .filter((key): key is Record<string, unknown> => Boolean(key))
        .every((key) => Object.keys(key).sort().join(",") === "PK,SK")
    ).toBe(true);
    expect(toPlanCycleQueueItem(cycle)).toMatchObject({
      GSI1PK: `TENANT#${cycle.tenant_id}#OWNER#Fictional Advisor#STAGE#Intake`,
      GSI1SK: `DUE#2026-08-31#PRIORITY#P1#CYCLE#${cycle.id}`,
      PK: `TENANT#${cycle.tenant_id}`,
      SK: `QUEUE#STAGE#Intake#DUE#2026-08-31#PRIORITY#P1#CYCLE#${cycle.id}`
    });
    expect(readYourOwnWrite).toMatchObject({
      due_date: "2026-01-15",
      overdue: true,
      stage: "Review"
    });
    expect(overdueRows).toHaveLength(1);
    expect(overdueRows[0]).toMatchObject({
      SK: `OVERDUE#DUE#2026-01-15#CYCLE#${cycle.id}`,
      overdue: true
    });
    expect(sentCommands.filter((command) => command instanceof QueryCommand)).toHaveLength(4);
    expect(sentCommands.map((command) => command?.constructor?.name)).not.toContain("ScanCommand");
  });

  it("exercises DynamoDB Local by creating the local table and running all access patterns", async () => {
    const rawClient = createDynamoDbClient();
    const docClient = createDynamoDocumentClient();

    await ensurePlanCycleQueueTable(rawClient);

    const projector = new DynamoPlanCycleQueueProjector(docClient);

    const cycleIntake = makeTaxPlanCycle({
      due_date: "2026-09-30",
      owner: "Local Integration Advisor",
      priority: "P1",
      stage: "Intake"
    });

    const cycleOverdue = makeTaxPlanCycle({
      due_date: "2026-01-10",
      owner: "Local Integration Advisor",
      priority: "P2",
      stage: "Intake",
      tenant_id: cycleIntake.tenant_id
    });

    // 1. Upsert cycles
    await projector.upsertCycle(cycleIntake);
    await projector.upsertCycle(cycleOverdue);

    // 2. Access pattern: getCycleById
    const fetchedById = await projector.getCycleById(cycleIntake.tenant_id, cycleIntake.id);
    expect(fetchedById).toMatchObject({
      id: cycleIntake.id,
      owner: "Local Integration Advisor",
      stage: "Intake",
      tenant_id: cycleIntake.tenant_id
    });

    // 3. Access pattern: listQueue (stage query)
    const stageQueue = await projector.listQueue({
      stage: "Intake",
      tenant_id: cycleIntake.tenant_id
    });
    expect(stageQueue.length).toBeGreaterThanOrEqual(2);
    expect(stageQueue.map((item) => item.id)).toContain(cycleIntake.id);

    // 4. Access pattern: listQueue with owner (GSI query)
    const ownerQueue = await projector.listQueue({
      owner: "Local Integration Advisor",
      stage: "Intake",
      tenant_id: cycleIntake.tenant_id
    });
    expect(ownerQueue.length).toBeGreaterThanOrEqual(2);
    expect(ownerQueue.every((item) => item.owner === "Local Integration Advisor")).toBe(true);

    // 5. Access pattern: listOverdueByDueDate
    const overdueList = await projector.listOverdueByDueDate(cycleIntake.tenant_id);
    expect(overdueList.some((item) => item.id === cycleOverdue.id)).toBe(true);

    // 6. Access pattern: deleteCycle
    await projector.deleteCycle(cycleIntake);
    const deletedFetch = await projector.getCycleById(cycleIntake.tenant_id, cycleIntake.id);
    expect(deletedFetch).toBeNull();
  });
});
