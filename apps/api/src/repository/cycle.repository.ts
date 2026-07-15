import { and, asc, eq } from "drizzle-orm";

import { getDb, type TaxPulseDb } from "../db/client.js";
import type { CreateCycleRequest, CycleResponse, TenantContext } from "../db/dto.js";
import {
  stageTransition,
  taxPlanCycle,
  type NewStageTransition,
  type StageTransition,
  type TaxPlanCycle
} from "../db/schema.js";

type TaxPulseTransaction = Parameters<Parameters<TaxPulseDb["transaction"]>[0]>[0];
type TaxPulseDbExecutor = TaxPulseDb | TaxPulseTransaction;

export interface CyclePing {
  dataAccess: "repository";
  service: "taxpulse-api";
  status: "ok";
}

export interface CycleWithTransitions {
  cycle: TaxPlanCycle;
  transitions: StageTransition[];
}

export async function getCyclePingFromRepository(): Promise<CyclePing> {
  return {
    dataAccess: "repository",
    service: "taxpulse-api",
    status: "ok"
  };
}

export async function insertCycleForTenant(
  tenantContext: TenantContext,
  input: CreateCycleRequest,
  db: TaxPulseDbExecutor = getDb()
): Promise<string> {
  const [inserted] = await db
    .insert(taxPlanCycle)
    .values({
      ...input,
      hold_reason: input.hold_reason ?? null,
      metadata: {},
      on_hold: input.on_hold,
      stage: "Intake",
      tenant_id: tenantContext.tenant_id
    })
    .returning({
      id: taxPlanCycle.id
    });

  if (!inserted) {
    throw new Error("Tax Plan Cycle insert did not return a generated id.");
  }

  return inserted.id;
}

export type NewStageTransitionInput = Pick<
  NewStageTransition,
  "actor" | "case_id" | "from_stage" | "to_stage"
>;

export async function insertStageTransitionForTenant(
  tenantContext: TenantContext,
  input: NewStageTransitionInput,
  db: TaxPulseDbExecutor = getDb()
): Promise<void> {
  await db.insert(stageTransition).values({
    ...input,
    tenant_id: tenantContext.tenant_id
  });
}

export async function createCycleWithInitialTransitionForTenant(
  tenantContext: TenantContext,
  input: CreateCycleRequest,
  initialTransition: Omit<NewStageTransitionInput, "case_id">,
  db: TaxPulseDb = getDb()
): Promise<string> {
  return db.transaction(async (tx) => {
    const id = await insertCycleForTenant(tenantContext, input, tx);

    await insertStageTransitionForTenant(
      tenantContext,
      {
        ...initialTransition,
        case_id: id
      },
      tx
    );

    return id;
  });
}

export async function findCycleByIdForTenant(
  tenantContext: TenantContext,
  id: string,
  db: TaxPulseDbExecutor = getDb()
): Promise<CycleResponse | null> {
  const [cycle] = await db
    .select()
    .from(taxPlanCycle)
    .where(and(eq(taxPlanCycle.tenant_id, tenantContext.tenant_id), eq(taxPlanCycle.id, id)))
    .limit(1);

  return cycle ?? null;
}

export async function listCyclesWithTransitionsForTenant(
  { tenant_id, limit = 50 }: TenantContext & { limit?: number },
  db: TaxPulseDb = getDb()
): Promise<CycleWithTransitions[]> {
  const tenantCycles = db
    .select()
    .from(taxPlanCycle)
    .where(eq(taxPlanCycle.tenant_id, tenant_id))
    .orderBy(asc(taxPlanCycle.due_date), asc(taxPlanCycle.id))
    .limit(limit)
    .as("tenant_cycles");

  const joinedRows = await db
    .select({
      cycle: {
        client_id: tenantCycles.client_id,
        created_at: tenantCycles.created_at,
        due_date: tenantCycles.due_date,
        hold_reason: tenantCycles.hold_reason,
        id: tenantCycles.id,
        metadata: tenantCycles.metadata,
        on_hold: tenantCycles.on_hold,
        owner: tenantCycles.owner,
        planning_period: tenantCycles.planning_period,
        priority: tenantCycles.priority,
        stage: tenantCycles.stage,
        tenant_id: tenantCycles.tenant_id,
        updated_at: tenantCycles.updated_at
      },
      transition: stageTransition
    })
    .from(tenantCycles)
    .leftJoin(
      stageTransition,
      and(
        eq(stageTransition.tenant_id, tenantCycles.tenant_id),
        eq(stageTransition.case_id, tenantCycles.id)
      )
    )
    .orderBy(
      asc(tenantCycles.due_date),
      asc(tenantCycles.id),
      asc(stageTransition.occurred_at),
      asc(stageTransition.id)
    );

  const rowsByCycleId = new Map<string, CycleWithTransitions>();

  for (const row of joinedRows) {
    const existing = rowsByCycleId.get(row.cycle.id);

    if (existing) {
      if (row.transition) {
        existing.transitions.push(row.transition);
      }
      continue;
    }

    rowsByCycleId.set(row.cycle.id, {
      cycle: row.cycle,
      transitions: row.transition ? [row.transition] : []
    });
  }

  return [...rowsByCycleId.values()];
}
