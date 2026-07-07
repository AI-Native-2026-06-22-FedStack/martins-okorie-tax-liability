import type { CreateCycleRequest, CycleResponse, TenantContext } from "../schemas/cycle.schema.js";

export const SYNTHETIC_CYCLE_ID = "33333333-3333-4333-8333-333333333333";
export const SYNTHETIC_TENANT_ID = "11111111-1111-4111-8111-111111111111";

export interface CyclePing {
  dataAccess: "repository";
  service: "taxpulse-api";
  status: "ok";
}

export async function getCyclePingFromRepository(): Promise<CyclePing> {
  // Deliverable 2 tenant-scoped reads plug in at this data-access seam.
  return {
    dataAccess: "repository",
    service: "taxpulse-api",
    status: "ok"
  };
}

export async function createCycleInRepository(
  tenantContext: TenantContext,
  input: CreateCycleRequest
): Promise<CycleResponse> {
  const timestamp = new Date().toISOString();

  return {
    ...input,
    hold_reason: input.hold_reason ?? null,
    id: SYNTHETIC_CYCLE_ID,
    on_hold: input.on_hold,
    stage: "Intake",
    tenant_id: tenantContext.tenant_id,
    created_at: timestamp,
    updated_at: timestamp
  };
}

export async function findCycleByIdForTenant(
  tenantContext: TenantContext,
  id: string
): Promise<CycleResponse | null> {
  if (tenantContext.tenant_id !== SYNTHETIC_TENANT_ID || id !== SYNTHETIC_CYCLE_ID) {
    return null;
  }

  return {
    client_id: "client-synthetic-001",
    created_at: "2026-07-07T00:00:00.000Z",
    due_date: "2026-09-30",
    hold_reason: null,
    id: SYNTHETIC_CYCLE_ID,
    on_hold: false,
    owner: "Fictional Advisor",
    planning_period: "2026 Q3",
    priority: "P2",
    stage: "Intake",
    tenant_id: SYNTHETIC_TENANT_ID,
    updated_at: "2026-07-07T00:00:00.000Z"
  };
}
