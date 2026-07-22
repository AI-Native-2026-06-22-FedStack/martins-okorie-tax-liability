import { Router } from "express";

import { cycleRouter } from "../cycle.routes.js";
import { cycleTransitionRouter } from "../cycle-transition.routes.js";
import { deprecatedCyclePingHeaders } from "./versioning.js";

export const v1Router = Router();

v1Router.get("/cycles/ping", deprecatedCyclePingHeaders);
v1Router.use("/cycles", cycleTransitionRouter);
v1Router.use("/cycles", cycleRouter);
