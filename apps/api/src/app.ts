import express, { type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { apiReference } from "@scalar/express-api-reference";

import { notFoundHandler, problemJsonErrorHandler } from "./errors/problem-json.js";
import { openApiDocument } from "./openapi/openapi.js";
import { cycleRouter } from "./routes/cycle.routes.js";

export const app = express();

app.use(express.json());
app.use(pinoHttp());

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    service: "taxpulse-api",
    status: "ok"
  });
});

app.use("/cycles", cycleRouter);

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
