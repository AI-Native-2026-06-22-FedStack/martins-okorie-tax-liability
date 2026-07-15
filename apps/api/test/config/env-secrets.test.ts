import type { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadApiEnv } from "../../src/config/env.js";
import {
  clearSecretCacheForTests,
  loadRuntimeSecrets,
  loadSecret
} from "../../src/config/secrets.js";

const validEnv = {
  AWS_ENDPOINT: "http://localhost.floci.io:4566",
  AWS_REGION: "us-east-1",
  PORT: "3000",
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_NAME: "taxpulse",
  DB_USER: "taxpulse_app",
  DB_SSL: "disable",
  DB_SECRET_ID: "taxpulse/db-password",
  JWT_SECRET_ID: "taxpulse/jwt-signing-keys",
  JWT_ISSUER: "taxpulse-api",
  JWT_AUDIENCE: "taxpulse-clients",
  SECRETS_REFRESH_MS: "300000"
};

describe("runtime env and managed secret loading", () => {
  afterEach(() => {
    clearSecretCacheForTests();
  });

  it("rejects malformed non-secret configuration at parse time", () => {
    expect(() =>
      loadApiEnv({
        ...validEnv,
        AWS_ENDPOINT: "not-a-url"
      })
    ).toThrow(/Invalid URL/);
  });

  it("loads runtime secrets from Secrets Manager and parses the JWT key payload", async () => {
    const env = loadApiEnv(validEnv);
    const client = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ SecretString: "synthetic-db-password" })
        .mockResolvedValueOnce({
          SecretString: JSON.stringify({
            keyId: "local-test-key",
            privateKey: "synthetic-private-key",
            publicKey: "synthetic-public-key"
          })
        })
    } as unknown as Pick<SecretsManagerClient, "send">;

    const secrets = await loadRuntimeSecrets(env, client);

    expect(secrets.databasePassword).toBe("synthetic-db-password");
    expect(secrets.jwtSigningKeys).toEqual({
      keyId: "local-test-key",
      privateKey: "synthetic-private-key",
      publicKey: "synthetic-public-key"
    });
  });

  it("caches secrets until the refresh window expires or a forced refresh is requested", async () => {
    const client = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ SecretString: "first-value" })
        .mockResolvedValueOnce({ SecretString: "second-value" })
    } as unknown as Pick<SecretsManagerClient, "send">;

    await expect(loadSecret("taxpulse/example", { client, refreshMs: 60_000 })).resolves.toBe(
      "first-value"
    );
    await expect(loadSecret("taxpulse/example", { client, refreshMs: 60_000 })).resolves.toBe(
      "first-value"
    );
    await expect(
      loadSecret("taxpulse/example", { client, forceRefresh: true, refreshMs: 60_000 })
    ).resolves.toBe("second-value");

    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it("throws a clear error when Secrets Manager returns no SecretString", async () => {
    const client = {
      send: vi.fn().mockResolvedValueOnce({})
    } as unknown as Pick<SecretsManagerClient, "send">;

    await expect(loadSecret("taxpulse/missing-value", { client })).rejects.toThrow(
      "Secret taxpulse/missing-value is missing SecretString"
    );
  });
});
