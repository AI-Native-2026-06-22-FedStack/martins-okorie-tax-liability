import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

export const ApiEnvSchema = z.object({
  AWS_ENDPOINT: z.url(),
  AWS_ENDPOINT_URL: z.url().optional(),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1).default("test"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).default("test"),
  PORT: z.coerce.number().int().positive(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_SSL: z.enum(["disable", "require"]).default("disable"),
  DB_SECRET_ID: z.string().min(1),
  JWT_SECRET_ID: z.string().min(1),
  JWT_ISSUER: z.string().min(1).default("taxpulse-api"),
  JWT_AUDIENCE: z.string().min(1).default("taxpulse-clients"),
  SPA_CLOUDFRONT_ORIGIN: z
    .url()
    .default("http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566"),
  SECRETS_REFRESH_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60_000),
  DDB_ENDPOINT: z.url().default("http://localhost:8000"),
  DDB_TABLE_NAME: z.string().min(1).default("taxpulse-plan-cycle-read-model"),
  STAGE_CHANGED_TOPIC: z.string().min(1).default("taxpulse-stage-changed"),
  STAGE_CHANGED_QUEUE: z.string().min(1).default("taxpulse-stage-changed-projection"),
  STAGE_CHANGED_DLQ: z.string().min(1).default("taxpulse-stage-changed-dlq"),
  QUEUE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  IDEMPOTENCY_LOCK_TTL_MS: z.coerce.number().int().positive().default(30_000)
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

let cachedEnv: ApiEnv | undefined;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(source);
}

export function getApiEnv(): ApiEnv {
  cachedEnv ??= loadApiEnv();
  return cachedEnv;
}

export function resetApiEnvForTests(): void {
  cachedEnv = undefined;
}
