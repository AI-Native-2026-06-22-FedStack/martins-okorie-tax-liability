import {
  createCycleWithInitialTransitionForTenant,
  findCycleByIdForTenant,
  getCyclePingFromRepository,
  type CyclePing
} from "../repository/cycle.repository.js";
import { NotFoundError } from "../errors/problem-json.js";
import type {
  CreateCycleRequest,
  CreateCycleResponse,
  CycleIdParams,
  CycleResponse,
  TenantContext
} from "../db/dto.js";

const INITIAL_STAGE_TRANSITION_ACTOR = "TaxPulse System";

export async function getCyclePing(): Promise<CyclePing> {
  return getCyclePingFromRepository();
}

export async function throwCycleError(): Promise<never> {
  throw new Error("Synthetic cycle route failure");
}

export async function createCycle(
  tenantContext: TenantContext,
  input: CreateCycleRequest
): Promise<CreateCycleResponse> {
  const id = await createCycleWithInitialTransitionForTenant(tenantContext, input, {
    actor: INITIAL_STAGE_TRANSITION_ACTOR,
    from_stage: null,
    to_stage: "Intake"
  });

  return { id };
}

export async function getCycleById(
  tenantContext: TenantContext,
  params: CycleIdParams
): Promise<CycleResponse> {
  const cycle = await findCycleByIdForTenant(tenantContext, params.id);

  if (!cycle) {
    throw new NotFoundError(`Tax Plan Cycle ${params.id} was not found for this tenant.`);
  }

  return cycle;
}
