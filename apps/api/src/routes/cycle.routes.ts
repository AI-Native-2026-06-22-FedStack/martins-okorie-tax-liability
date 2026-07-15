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
