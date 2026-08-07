import { Router } from "express";

import {
  createCycleController,
  getCycleByIdController,
  getCyclePingController,
  listPlanCycleQueueController,
  throwCycleErrorController,
  verifyIntakeTaxpayerController
} from "../controllers/cycle.controller.js";
import { requireAuth } from "../auth/verifier.js";
import { idempotencyKeyMiddleware } from "../store/idempotency.js";
import { tenantRateLimiter, tenantSlowDown } from "../middleware/rate-limit.js";

export const cycleRouter = Router();

cycleRouter.get("/ping", getCyclePingController);
cycleRouter.get("/error", throwCycleErrorController);
cycleRouter.post(
  "/",
  requireAuth,
  idempotencyKeyMiddleware,
  tenantSlowDown,
  tenantRateLimiter,
  createCycleController
);
cycleRouter.get("/queue", requireAuth, listPlanCycleQueueController);
cycleRouter.post(
  "/:id/intake/taxpayer-verification",
  requireAuth,
  tenantSlowDown,
  tenantRateLimiter,
  verifyIntakeTaxpayerController
);
cycleRouter.get("/:id", getCycleByIdController);

interface ComputeRequestBody {
  income?: unknown;
  deductions?: unknown;
}

cycleRouter.post(
  "/:id/compute",
  requireAuth,
  tenantSlowDown,
  tenantRateLimiter,
  async (req, res) => {
    const correlationId = req.correlationId;
    const token = req.headers.authorization;
    const body = req.body as ComputeRequestBody;
    const incomeVal = typeof body.income === "number" ? body.income : 0;
    const deductionsVal = typeof body.deductions === "number" ? body.deductions : 0;

    try {
      const response = await fetch("http://127.0.0.1:8000/compute/tax-liability", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: token || "",
          "x-correlation-id": correlationId
        },
        body: JSON.stringify({
          income: incomeVal,
          deductions: deductionsVal
        })
      });

      if (!response.ok) {
        req.log.error({ status: response.status }, "Compute service call failed");
        return res.status(response.status).json({ detail: "Compute service call failed" });
      }

      const data = await response.json();
      req.log.info({ data }, "Compute service call successful");
      return res.json(data);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      req.log.error({ err: errMsg }, "Failed to connect to compute service");
      return res.status(502).json({ detail: "Bad Gateway" });
    }
  }
);
