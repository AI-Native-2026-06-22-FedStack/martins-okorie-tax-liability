import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

export const ApiEnvSchema = z.object({
  AWS_ENDPOINT: z.url(),
  AWS_REGION: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_SSL: z
    .enum(["disable", "require"])
    .default("disable"),
  DB_SECRET_ID: z.string().min(1),
  JWT_SECRET_ID: z.string().min(1),
  JWT_ISSUER: z.string().min(1).default("taxpulse-api"),
  JWT_AUDIENCE: z.string().min(1).default("taxpulse-clients"),
  SECRETS_REFRESH_MS: z.coerce.number().int().positive().default(5 * 60_000)
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
