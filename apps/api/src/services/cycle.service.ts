import {
  createCycleInRepository,
  findCycleByIdForTenant,
  getCyclePingFromRepository,
  type CyclePing
} from "../repository/cycle.repository.js";
import { NotFoundError } from "../errors/problem-json.js";
import type {
  CreateCycleRequest,
  CycleIdParams,
  CycleResponse,
  TenantContext
} from "../schemas/cycle.schema.js";

export async function getCyclePing(): Promise<CyclePing> {
  return getCyclePingFromRepository();
}

export async function throwCycleError(): Promise<never> {
  throw new Error("Synthetic cycle route failure");
}

export async function createCycle(
  tenantContext: TenantContext,
  input: CreateCycleRequest
): Promise<CycleResponse> {
  return createCycleInRepository(tenantContext, input);
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
