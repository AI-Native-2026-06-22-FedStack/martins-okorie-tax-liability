import type { RequestHandler } from "express";
import { z } from "zod";

export const CorsEnvSchema = z.object({
  SPA_CLOUDFRONT_ORIGIN: z
    .url()
    .default("http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566")
});

export type CorsConfig = {
  allowedOrigin: string;
  allowedHeaders: readonly string[];
  allowedMethods: readonly string[];
};

export function loadCorsConfig(source: NodeJS.ProcessEnv = process.env): CorsConfig {
  const env = CorsEnvSchema.parse(source);

  return {
    allowedOrigin: env.SPA_CLOUDFRONT_ORIGIN,
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-Id"],
    allowedMethods: ["GET", "POST", "PATCH"]
  };
}

export function createCorsMiddleware(config: CorsConfig): RequestHandler {
  return (req, res, next) => {
    const origin = req.header("Origin");

    if (origin === config.allowedOrigin) {
      res.header("Access-Control-Allow-Origin", config.allowedOrigin);
      res.header("Access-Control-Allow-Methods", config.allowedMethods.join(", "));
      res.header("Access-Control-Allow-Headers", config.allowedHeaders.join(", "));
      res.header("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(origin === config.allowedOrigin ? 204 : 403);
      return;
    }

    next();
  };
}
