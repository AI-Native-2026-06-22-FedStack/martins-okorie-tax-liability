import crypto from "node:crypto";
import jwt from "jsonwebtoken";

let privateKey: string;
let publicKey: string;

// Initialize key material at runtime (never commit a private key)
if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
  privateKey = process.env.JWT_PRIVATE_KEY;
  publicKey = process.env.JWT_PUBLIC_KEY;
} else {
  // Generate a key pair dynamically in-memory for local dev & testing
  const keys = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  privateKey = keys.privateKey;
  publicKey = keys.publicKey;
}

export function getPrivateKey(): string {
  return privateKey;
}

export function getPublicKey(): string {
  return publicKey;
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
  const issuer = process.env.JWT_ISSUER || "taxpulse-api";
  const audience = process.env.JWT_AUDIENCE || "taxpulse-clients";

  return jwt.sign(
    {
      tenant_id: payload.tenant_id,
      role: payload.role
    },
    privateKey,
    {
      algorithm: "RS256",
      keyid: "2026-07", // Rotatable Key ID
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
  const issuer = process.env.JWT_ISSUER || "taxpulse-api";
  const audience = process.env.JWT_AUDIENCE || "taxpulse-clients";

  return jwt.sign(
    {
      tenant_id: payload.tenant_id,
      role: payload.role,
      mfa_pending: true
    },
    privateKey,
    {
      algorithm: "RS256",
      keyid: "2026-07",
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
