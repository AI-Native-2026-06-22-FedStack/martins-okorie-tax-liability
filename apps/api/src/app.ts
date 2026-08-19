import express, { type Request, type Response } from "express";
import { apiReference } from "@scalar/express-api-reference";

import { checkDatabaseReady } from "./db/client.js";
import { notFoundHandler, problemJsonErrorHandler } from "./errors/problem-json.js";
import { openApiDocument } from "./openapi/openapi.js";
import { authRouter } from "./routes/auth.routes.js";
import passport from "passport";
import { initializePassport } from "./auth/verifier.js";
import { correlationMiddleware } from "./logging/correlation.js";
import { costHeaderMiddleware } from "./middleware/cost-header.js";
import { v1Router } from "./routes/v1/index.js";
import { createCorsMiddleware, loadCorsConfig } from "./config/cors.js";

export const app = express();
initializePassport();

app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.json());
app.use(createCorsMiddleware(loadCorsConfig()));
app.use(correlationMiddleware);
app.use(costHeaderMiddleware);
app.use(passport.initialize());

app.use("/auth", authRouter);

app.get(["/health", "/healthz"], (_req: Request, res: Response) => {
  res.json({
    service: "taxpulse-api",
    status: "ok"
  });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await checkDatabaseReady();
    res.json({
      database: "ok",
      service: "taxpulse-api",
      status: "ready"
    });
  } catch {
    res.status(503).json({
      database: "unreachable",
      service: "taxpulse-api",
      status: "not_ready"
    });
  }
});

app.use("/v1", v1Router);

app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});
app.use(
  "/docs",
  apiReference({
    spec: {
      url: "/openapi.json"
    }
  })
);

app.use(notFoundHandler);
app.use(problemJsonErrorHandler);
