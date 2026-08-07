import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  parsePresentToClientCloudEvent,
  presentToClientEventSource,
  presentToClientEventType,
  type PresentToClientCloudEvent
} from "@capstone/shared-schemas";

import { writeAuditEntry } from "../audit/audit-writer.js";
import { getDb, type TaxPulseDb } from "../db/client.js";
import {
  actionItem,
  auditEntry,
  stageTransition,
  taxPlanCycle,
  type TaxPlanCycleStage
} from "../db/schema.js";
import { insertPresentToClientOutboxEvent } from "../repository/outbox.repository.js";

type TaxPulseTransaction = Parameters<Parameters<TaxPulseDb["transaction"]>[0]>[0];
type TaxPulseDbExecutor = TaxPulseDb | TaxPulseTransaction;

export interface PresentToClientActionItemInput {
  deadline: string;
  description: string;
}

export interface PresentToClientSagaInput {
  actionItems: PresentToClientActionItemInput[];
  actor: string;
  cycleId: string;
  presentedAt?: Date;
  tenantId: string;
}

export interface PresentToClientSagaResult {
  actionItemIds: string[];
  event: PresentToClientCloudEvent;
}

export interface PresentToClientSagaDependencies {
  createActionItems?: (
    input: PresentToClientSagaInput,
    db: TaxPulseDbExecutor
  ) => Promise<string[]>;
  db?: TaxPulseDb;
  now?: () => Date;
}

const presentedStage: TaxPlanCycleStage = "Client Approval";
const compensationAuditAction = "cycle.present-to-client.compensated";

export function buildPresentToClientCloudEvent(
  input: PresentToClientSagaInput,
  now = new Date()
): PresentToClientCloudEvent {
  const presentedAt = input.presentedAt ?? now;
  const presentedAtIso = presentedAt.toISOString();

  return parsePresentToClientCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source: presentToClientEventSource,
    type: presentToClientEventType,
    time: presentedAtIso,
    subject: `tax-plan-cycle/${input.cycleId}`,
    datacontenttype: "application/json",
    data: {
      tenant_id: input.tenantId,
      cycle_id: input.cycleId,
      presented_by: input.actor,
      presented_at: presentedAtIso,
      action_items: input.actionItems
    }
  });
}

export async function runPresentToClientSaga(
  input: PresentToClientSagaInput,
  {
    createActionItems = createCaseActionItems,
    db = getDb(),
    now = () => new Date()
  }: PresentToClientSagaDependencies = {}
): Promise<PresentToClientSagaResult> {
  const event = buildPresentToClientCloudEvent(input, now());
  let advanced = false;

  await db.transaction(async (tx) => {
    await advanceCycleToClientApproval(input, tx, now());
    advanced = true;
  });

  try {
    const actionItemIds = await db.transaction(async (tx) => {
      const ids = await createActionItems(input, tx);
      await insertPresentToClientOutboxEvent(event, tx);
      return ids;
    });

    return { actionItemIds, event };
  } catch (error) {
    if (advanced) {
      await compensatePresentToClientFailure(
        {
          actor: input.actor,
          cycleId: input.cycleId,
          reason: `Action item creation failed: ${errorMessage(error)}`,
          tenantId: input.tenantId
        },
        { db, now }
      );
    }

    throw error;
  }
}

async function advanceCycleToClientApproval(
  input: PresentToClientSagaInput,
  tx: TaxPulseTransaction,
  occurredAt: Date
): Promise<void> {
  const [cycle] = await tx
    .select({ stage: taxPlanCycle.stage })
    .from(taxPlanCycle)
    .where(and(eq(taxPlanCycle.id, input.cycleId), eq(taxPlanCycle.tenant_id, input.tenantId)));

  if (!cycle) {
    throw new Error("Tax Plan Cycle not found.");
  }

  if (cycle.stage !== "Review") {
    throw new Error("Tax Plan Cycle must be in Review before it can be presented to the client.");
  }

  await tx
    .update(taxPlanCycle)
    .set({ stage: presentedStage, updated_at: occurredAt })
    .where(and(eq(taxPlanCycle.id, input.cycleId), eq(taxPlanCycle.tenant_id, input.tenantId)));

  await tx.insert(stageTransition).values({
    actor: input.actor,
    case_id: input.cycleId,
    from_stage: "Review",
    occurred_at: occurredAt,
    tenant_id: input.tenantId,
    to_stage: presentedStage
  });

  await writeAuditEntry(
    {
      action: "cycle.present-to-client.started",
      actor: input.actor,
      case_id: input.cycleId,
      occurred_at: occurredAt,
      reason: "Tax Plan Cycle presented to client.",
      result: "success",
      tenant_id: input.tenantId
    },
    tx
  );
}

async function createCaseActionItems(
  input: PresentToClientSagaInput,
  db: TaxPulseDbExecutor
): Promise<string[]> {
  const rows = await db
    .insert(actionItem)
    .values(
      input.actionItems.map((item) => ({
        case_id: input.cycleId,
        deadline: item.deadline,
        description: item.description,
        tenant_id: input.tenantId
      }))
    )
    .returning({ id: actionItem.id });

  return rows.map((row) => row.id);
}

export async function compensatePresentToClientFailure(
  input: {
    actor: string;
    cycleId: string;
    reason: string;
    tenantId: string;
  },
  { db = getDb(), now = () => new Date() }: Pick<PresentToClientSagaDependencies, "db" | "now"> = {}
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existingCompensation] = await tx
      .select({ id: auditEntry.id })
      .from(auditEntry)
      .where(
        and(
          eq(auditEntry.tenant_id, input.tenantId),
          eq(auditEntry.case_id, input.cycleId),
          eq(auditEntry.action, compensationAuditAction)
        )
      )
      .limit(1);

    const [cycle] = await tx
      .select({ stage: taxPlanCycle.stage })
      .from(taxPlanCycle)
      .where(and(eq(taxPlanCycle.id, input.cycleId), eq(taxPlanCycle.tenant_id, input.tenantId)));

    if (!cycle) {
      throw new Error("Tax Plan Cycle not found for compensation.");
    }

    const occurredAt = now();

    if (cycle.stage !== "Review") {
      await tx
        .update(taxPlanCycle)
        .set({ stage: "Review", updated_at: occurredAt })
        .where(and(eq(taxPlanCycle.id, input.cycleId), eq(taxPlanCycle.tenant_id, input.tenantId)));

      await tx.insert(stageTransition).values({
        actor: input.actor,
        case_id: input.cycleId,
        from_stage: cycle.stage,
        occurred_at: occurredAt,
        tenant_id: input.tenantId,
        to_stage: "Review"
      });
    }

    if (!existingCompensation) {
      await writeAuditEntry(
        {
          action: compensationAuditAction,
          actor: input.actor,
          case_id: input.cycleId,
          occurred_at: occurredAt,
          reason: input.reason,
          result: "success",
          tenant_id: input.tenantId
        },
        tx
      );
    }
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
