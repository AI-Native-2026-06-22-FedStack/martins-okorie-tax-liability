import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { getApiEnv } from "../config/env.js";
import { getRuntimeSecrets, type JwtSigningKeys } from "../config/secrets.js";

let testSigningKeys: JwtSigningKeys | undefined;

function isVitest(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

function createEphemeralTestKeys(): JwtSigningKeys {
  const keys = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  return {
    keyId: "2026-07",
    privateKey: keys.privateKey,
    publicKey: keys.publicKey
  };
}

function getSigningKeys(): JwtSigningKeys {
  try {
    return getRuntimeSecrets().jwtSigningKeys;
  } catch (error) {
    if (isVitest()) {
      testSigningKeys ??= createEphemeralTestKeys();
      return testSigningKeys;
    }

    throw error;
  }
}

export function getJwtConfig(): { audience: string; issuer: string } {
  try {
    const env = getApiEnv();
    return {
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER
    };
  } catch (error) {
    if (isVitest()) {
      return {
        audience: "taxpulse-clients",
        issuer: "taxpulse-api"
      };
    }

    throw error;
  }
}

export function getPrivateKey(): string {
  return getSigningKeys().privateKey;
}

export function getPublicKey(): string {
  return getSigningKeys().publicKey;
}

export interface TokenPayload {
  sub: string;
  tenant_id: string;
  role: string;
}

/**
 * Sign an access token using RS256 with standard claims and kid in the header.
 */
export function signAccessToken(payload: TokenPayload): string {
  const { audience, issuer } = getJwtConfig();
  const keys = getSigningKeys();

  return jwt.sign(
    {
      tenant_id: payload.tenant_id,
      role: payload.role
    },
    keys.privateKey,
    {
      algorithm: "RS256",
      keyid: keys.keyId,
      issuer,
      audience,
      expiresIn: "15m",
      subject: payload.sub
    }
  );
}

/**
 * Sign a temporary token valid during the MFA verification challenge window.
 */
export function signTempMfaToken(payload: TokenPayload): string {
  const { audience, issuer } = getJwtConfig();
  const keys = getSigningKeys();

  return jwt.sign(
    {
      tenant_id: payload.tenant_id,
      role: payload.role,
      mfa_pending: true
    },
    keys.privateKey,
    {
      algorithm: "RS256",
      keyid: keys.keyId,
      issuer,
      audience,
      expiresIn: "3m",
      subject: payload.sub
    }
  );
}

/**
 * Generate a random cryptographically secure refresh token string.
 */
export function generateRefreshTokenString(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash the refresh token to prevent replay attacks in case of database leakage.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
