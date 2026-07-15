import {
  GetSecretValueCommand,
  SecretsManagerClient
} from "@aws-sdk/client-secrets-manager";
import { z } from "zod";

import { getApiEnv, type ApiEnv } from "./env.js";

export interface SecretCacheEntry {
  fetchedAt: number;
  value: string;
}

export interface JwtSigningKeys {
  keyId: string;
  privateKey: string;
  publicKey: string;
}

export interface RuntimeSecrets {
  databasePassword: string;
  jwtSigningKeys: JwtSigningKeys;
}

const JwtSigningKeysSchema = z.object({
  keyId: z.string().min(1).default("2026-07"),
  privateKey: z.string().min(1),
  publicKey: z.string().min(1)
});

const DEFAULT_REFRESH_MS = 5 * 60_000;
const secretCache = new Map<string, SecretCacheEntry>();

let runtimeSecrets: RuntimeSecrets | undefined;
let refreshTimer: NodeJS.Timeout | undefined;

function createSecretsClient(env: ApiEnv): SecretsManagerClient {
  return new SecretsManagerClient({
    endpoint: env.AWS_ENDPOINT,
    region: env.AWS_REGION
  });
}

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

async function fetchSecretString(
  client: Pick<SecretsManagerClient, "send">,
  secretId: string
): Promise<string> {
  try {
    const output = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!output.SecretString) {
      throw new Error(`Secret ${secretId} is missing SecretString.`);
    }

    return output.SecretString;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load secret ${secretId}: ${message}`);
  }
}

export async function loadSecret(
  secretId: string,
  {
    client = createSecretsClient(getApiEnv()),
    forceRefresh = false,
    refreshMs = DEFAULT_REFRESH_MS
  }: {
    client?: Pick<SecretsManagerClient, "send">;
    forceRefresh?: boolean;
    refreshMs?: number;
  } = {}
): Promise<string> {
  const cached = secretCache.get(secretId);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < refreshMs) {
    return cached.value;
  }

  const value = await fetchSecretString(client, secretId);
  secretCache.set(secretId, {
    fetchedAt: Date.now(),
    value
  });
  return value;
}

function parseJwtSigningKeys(secretString: string): JwtSigningKeys {
  const parsed = JSON.parse(secretString) as unknown;
  return JwtSigningKeysSchema.parse(parsed);
}

export async function loadRuntimeSecrets(
  env: ApiEnv = getApiEnv(),
  client: Pick<SecretsManagerClient, "send"> = createSecretsClient(env)
): Promise<RuntimeSecrets> {
  const [databasePassword, jwtSigningKeysSecret] = await Promise.all([
    loadSecret(env.DB_SECRET_ID, { client, forceRefresh: true }),
    loadSecret(env.JWT_SECRET_ID, { client, forceRefresh: true })
  ]);

  return {
    databasePassword,
    jwtSigningKeys: parseJwtSigningKeys(jwtSigningKeysSecret)
  };
}

export async function initializeRuntimeSecrets(env: ApiEnv = getApiEnv()): Promise<RuntimeSecrets> {
  runtimeSecrets = await loadRuntimeSecrets(env);
  clearRefreshTimer();

  refreshTimer = setInterval(() => {
    void refreshRuntimeSecrets(env).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Runtime secret refresh failed; keeping cached values. ${message}`);
    });
  }, env.SECRETS_REFRESH_MS);
  refreshTimer.unref();

  return runtimeSecrets;
}

export async function refreshRuntimeSecrets(env: ApiEnv = getApiEnv()): Promise<RuntimeSecrets> {
  runtimeSecrets = await loadRuntimeSecrets(env);
  return runtimeSecrets;
}

export function getRuntimeSecrets(): RuntimeSecrets {
  if (!runtimeSecrets) {
    throw new Error("Runtime secrets have not been initialized. Refusing to use undefined secrets.");
  }

  return runtimeSecrets;
}

export function clearSecretCacheForTests(): void {
  secretCache.clear();
  runtimeSecrets = undefined;
  clearRefreshTimer();
}
