import { Router } from "express";

import {
  createCycleController,
  getCycleByIdController,
  getCyclePingController,
  throwCycleErrorController
} from "../controllers/cycle.controller.js";

export const cycleRouter = Router();

cycleRouter.get("/ping", getCyclePingController);
cycleRouter.get("/error", throwCycleErrorController);
cycleRouter.post("/", createCycleController);
cycleRouter.get("/:id", getCycleByIdController);
