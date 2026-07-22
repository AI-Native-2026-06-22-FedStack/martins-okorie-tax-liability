import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException
} from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
  DynamoDBDocumentClient,
  type DynamoDBDocumentClient as DynamoDBDocumentClientType
} from "@aws-sdk/lib-dynamodb";

import { getApiEnv } from "../config/env.js";
import type { TaxPlanCycle } from "../db/schema.js";

export const PLAN_CYCLE_QUEUE_GSI_NAME = "GSI1";

export interface PlanCycleQueueReadModel {
  GSI1PK?: string;
  GSI1SK?: string;
  PK: string;
  SK: string;
  client_id: string;
  due_date: string;
  hold_reason: string | null;
  id: string;
  on_hold: boolean;
  overdue: boolean;
  owner: string;
  planning_period: string;
  priority: string;
  stage: string;
  tenant_id: string;
}

export interface PlanCycleQueueReadQuery {
  limit?: number;
  owner?: string;
  stage: string;
  tenant_id: string;
}

export interface PlanCycleQueueProjector {
  deleteCycle(cycle: TaxPlanCycle): Promise<void>;
  getCycleById(tenantId: string, cycleId: string): Promise<PlanCycleQueueReadModel | null>;
  listOverdueByDueDate(tenantId: string, limit?: number): Promise<PlanCycleQueueReadModel[]>;
  listQueue(query: PlanCycleQueueReadQuery): Promise<PlanCycleQueueReadModel[]>;
  upsertCycle(cycle: TaxPlanCycle): Promise<void>;
}

interface PlanCycleQueueKeys {
  cycle: {
    PK: string;
    SK: string;
  };
  overdue: {
    PK: string;
    SK: string;
  };
  queue: {
    GSI1PK: string;
    GSI1SK: string;
    PK: string;
    SK: string;
  };
}

export function createDynamoDbClient(): DynamoDBClient {
  const env = getApiEnv();

  return new DynamoDBClient({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test"
    },
    endpoint: env.DDB_ENDPOINT,
    region: env.AWS_REGION
  });
}

export function createDynamoDocumentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(createDynamoDbClient());
}

export async function ensurePlanCycleQueueTable(
  client: DynamoDBClient = createDynamoDbClient()
): Promise<void> {
  const env = getApiEnv();

  try {
    await client.send(new DescribeTableCommand({ TableName: env.DDB_TABLE_NAME }));
    return;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    if (
      !(error instanceof ResourceNotFoundException) &&
      errorName !== "ResourceNotFoundException"
    ) {
      throw error;
    }
  }

  await client.send(
    new CreateTableCommand({
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" }
      ],
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          IndexName: PLAN_CYCLE_QUEUE_GSI_NAME,
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" }
          ],
          Projection: {
            ProjectionType: "ALL"
          }
        }
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" }
      ],
      TableName: env.DDB_TABLE_NAME
    })
  );
}

function buildPlanCycleQueueKeys(input: TaxPlanCycle): PlanCycleQueueKeys {
  const orderedSuffix = `DUE#${input.due_date}#PRIORITY#${input.priority}#CYCLE#${input.id}`;
  const tenantPk = `TENANT#${input.tenant_id}`;

  return {
    cycle: {
      PK: tenantPk,
      SK: `CYCLE#${input.id}`
    },
    overdue: {
      PK: tenantPk,
      SK: `OVERDUE#DUE#${input.due_date}#CYCLE#${input.id}`
    },
    queue: {
      GSI1PK: `TENANT#${input.tenant_id}#OWNER#${input.owner}#STAGE#${input.stage}`,
      GSI1SK: orderedSuffix,
      PK: tenantPk,
      SK: `QUEUE#STAGE#${input.stage}#${orderedSuffix}`
    }
  };
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function baseProjectedCycleFields(cycle: TaxPlanCycle, now = new Date()) {
  return {
    client_id: cycle.client_id,
    due_date: cycle.due_date,
    hold_reason: cycle.hold_reason,
    id: cycle.id,
    on_hold: cycle.on_hold,
    overdue: cycle.due_date < dateOnly(now),
    owner: cycle.owner,
    planning_period: cycle.planning_period,
    priority: cycle.priority,
    stage: cycle.stage,
    tenant_id: cycle.tenant_id
  };
}

export function toPlanCycleQueueItem(
  cycle: TaxPlanCycle,
  now = new Date()
): PlanCycleQueueReadModel {
  const keys = buildPlanCycleQueueKeys(cycle);

  return {
    ...keys.queue,
    ...baseProjectedCycleFields(cycle, now)
  };
}

export function toPlanCycleByIdItem(
  cycle: TaxPlanCycle,
  now = new Date()
): PlanCycleQueueReadModel {
  const keys = buildPlanCycleQueueKeys(cycle);

  return {
    ...keys.cycle,
    ...baseProjectedCycleFields(cycle, now)
  };
}

export function toOverduePlanCycleItem(
  cycle: TaxPlanCycle,
  now = new Date()
): PlanCycleQueueReadModel | null {
  const projectedFields = baseProjectedCycleFields(cycle, now);
  if (!projectedFields.overdue) {
    return null;
  }

  return {
    ...buildPlanCycleQueueKeys(cycle).overdue,
    ...projectedFields
  };
}

function projectionItemsForCycle(cycle: TaxPlanCycle): PlanCycleQueueReadModel[] {
  const overdueItem = toOverduePlanCycleItem(cycle);
  return [
    toPlanCycleByIdItem(cycle),
    toPlanCycleQueueItem(cycle),
    ...(overdueItem ? [overdueItem] : [])
  ];
}

export class DynamoPlanCycleQueueProjector implements PlanCycleQueueProjector {
  private ensureTablePromise: Promise<void> | undefined;

  constructor(
    private readonly documentClient: DynamoDBDocumentClientType = createDynamoDocumentClient(),
    private readonly tableName = getApiEnv().DDB_TABLE_NAME,
    private readonly ensureTableFn = () => ensurePlanCycleQueueTable(createDynamoDbClient())
  ) {}

  private async ensureTable(): Promise<void> {
    this.ensureTablePromise ??= this.ensureTableFn();
    await this.ensureTablePromise;
  }

  async upsertCycle(cycle: TaxPlanCycle): Promise<void> {
    await this.ensureTable();
    const items = projectionItemsForCycle(cycle);

    if (items.length === 1) {
      await this.documentClient.send(
        new PutCommand({
          Item: items[0],
          TableName: this.tableName
        })
      );
      return;
    }

    await this.documentClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: items.map((item) => ({
            PutRequest: {
              Item: item
            }
          }))
        }
      })
    );
  }

  async deleteCycle(cycle: TaxPlanCycle): Promise<void> {
    await this.ensureTable();
    const keys = buildPlanCycleQueueKeys(cycle);
    await this.documentClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: [
            keys.cycle,
            { PK: keys.queue.PK, SK: keys.queue.SK },
            keys.overdue
          ].map((key) => ({
            DeleteRequest: {
              Key: key
            }
          }))
        }
      })
    );
  }

  async getCycleById(tenantId: string, cycleId: string): Promise<PlanCycleQueueReadModel | null> {
    await this.ensureTable();
    const result = await this.documentClient.send(
      new QueryCommand({
        ConsistentRead: true,
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `CYCLE#${cycleId}`
        },
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        Limit: 1,
        TableName: this.tableName
      })
    );

    return ((result.Items ?? [])[0] as PlanCycleQueueReadModel | undefined) ?? null;
  }

  async listOverdueByDueDate(tenantId: string, limit?: number): Promise<PlanCycleQueueReadModel[]> {
    await this.ensureTable();
    const result = await this.documentClient.send(
      new QueryCommand({
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": "OVERDUE#DUE#"
        },
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        Limit: limit,
        TableName: this.tableName
      })
    );

    return (result.Items ?? []) as PlanCycleQueueReadModel[];
  }

  async listQueue(query: PlanCycleQueueReadQuery): Promise<PlanCycleQueueReadModel[]> {
    await this.ensureTable();
    const command = query.owner
      ? new QueryCommand({
          ExpressionAttributeValues: {
            ":pk": `TENANT#${query.tenant_id}#OWNER#${query.owner}#STAGE#${query.stage}`
          },
          IndexName: PLAN_CYCLE_QUEUE_GSI_NAME,
          KeyConditionExpression: "GSI1PK = :pk",
          Limit: query.limit,
          TableName: this.tableName
        })
      : new QueryCommand({
          ExpressionAttributeValues: {
            ":pk": `TENANT#${query.tenant_id}`,
            ":sk": `QUEUE#STAGE#${query.stage}#`
          },
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          Limit: query.limit,
          TableName: this.tableName
        });

    const result = await this.documentClient.send(command);
    return (result.Items ?? []) as PlanCycleQueueReadModel[];
  }
}

let defaultProjector: PlanCycleQueueProjector | undefined;

export function getPlanCycleQueueProjector(): PlanCycleQueueProjector {
  defaultProjector ??= new DynamoPlanCycleQueueProjector();
  return defaultProjector;
}

export function setPlanCycleQueueProjectorForTests(
  projector: PlanCycleQueueProjector | undefined
): void {
  defaultProjector = projector;
}
