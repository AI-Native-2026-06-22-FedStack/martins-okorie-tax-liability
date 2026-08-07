import type { Request, Response } from "express";

import {
  createCycle,
  getCycleById,
  getCyclePing,
  throwCycleError
} from "../services/cycle.service.js";
import {
  CreateCycleResponseSchema,
  CreateCycleRequestSchema,
  CycleIdParamsSchema,
  CycleResponseSchema,
  TenantContextSchema
} from "../db/dto.js";
import { ListPlanCycleQueueQuerySchema } from "../db/dto.js";
import { listCachedPlanCycleQueue } from "../store/queueCache.js";
import {
  IntakeTaxpayerVerificationRequestSchema,
  verifyTaxpayerForIntake
} from "../tivs/intake-taxpayer-verification.js";

type EmptyParams = Record<string, never>;

export async function getCyclePingController(_req: Request, res: Response): Promise<void> {
  res.json(await getCyclePing());
}

export async function throwCycleErrorController(_req: Request, _res: Response): Promise<void> {
  await throwCycleError();
}

export async function createCycleController(
  req: Request<EmptyParams, unknown, unknown>,
  res: Response
): Promise<void> {
  const tenantContext = TenantContextSchema.parse({
    tenant_id: req.user?.tenant_id || req.get("x-tenant-id")
  });
  const input = CreateCycleRequestSchema.parse(req.body);
  const result = await createCycle(tenantContext, input);

  res.status(201).json(CreateCycleResponseSchema.parse(result));
}

export async function getCycleByIdController(
  req: Request<Record<string, string>, unknown, unknown>,
  res: Response
): Promise<void> {
  const tenantContext = TenantContextSchema.parse({
    tenant_id: req.get("x-tenant-id")
  });
  const params = CycleIdParamsSchema.parse(req.params);
  const cycle = await getCycleById(tenantContext, params);

  res.json(CycleResponseSchema.parse(cycle));
}

export async function listPlanCycleQueueController(
  req: Request<EmptyParams, unknown, unknown>,
  res: Response
): Promise<void> {
  const tenantContext = TenantContextSchema.parse({
    tenant_id: req.user?.tenant_id
  });
  const query = ListPlanCycleQueueQuerySchema.parse(req.query);
  const rows = await listCachedPlanCycleQueue({
    ...query,
    tenant_id: tenantContext.tenant_id
  });

  res.json({ data: rows });
}

export async function verifyIntakeTaxpayerController(
  req: Request<Record<string, string>, unknown, unknown>,
  res: Response
): Promise<void> {
  const tenantContext = TenantContextSchema.parse({
    tenant_id: req.user?.tenant_id
  });
  const params = CycleIdParamsSchema.parse(req.params);
  const input = IntakeTaxpayerVerificationRequestSchema.parse(req.body);
  const result = await verifyTaxpayerForIntake({
    actor: req.user?.id ?? "TaxPulse System",
    correlationId: req.correlationId,
    cycleId: params.id,
    request: input,
    tenantId: tenantContext.tenant_id
  });

  res.status(200).json(result);
}
