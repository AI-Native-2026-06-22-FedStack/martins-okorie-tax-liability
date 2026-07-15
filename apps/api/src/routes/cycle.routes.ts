import { Router } from "express";

import {
  createCycleController,
  getCycleByIdController,
  getCyclePingController,
  throwCycleErrorController
} from "../controllers/cycle.controller.js";
import { requireAuth } from "../auth/verifier.js";

export const cycleRouter = Router();

cycleRouter.get("/ping", getCyclePingController);
cycleRouter.get("/error", throwCycleErrorController);
cycleRouter.post("/", requireAuth, createCycleController);
cycleRouter.get("/:id", getCycleByIdController);

cycleRouter.post("/:id/compute", requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const token = req.headers.authorization;
  const { income, deductions } = req.body;

  try {
    const response = await fetch("http://127.0.0.1:8000/compute/tax-liability", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": token || "",
        "x-correlation-id": correlationId
      },
      body: JSON.stringify({
        income: income ?? 0,
        deductions: deductions ?? 0
      })
    });

    if (!response.ok) {
      req.log.error({ status: response.status }, "Compute service call failed");
      return res.status(response.status).json({ detail: "Compute service call failed" });
    }

    const data = await response.json();
    req.log.info({ data }, "Compute service call successful");
    return res.json(data);
  } catch (err: any) {
    req.log.error({ err }, "Failed to connect to compute service");
    return res.status(502).json({ detail: "Bad Gateway" });
  }
});
