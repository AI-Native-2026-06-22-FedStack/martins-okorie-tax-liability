import { Router } from "express";

import { loginController, mfaController } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", loginController);
authRouter.post("/mfa", mfaController);
