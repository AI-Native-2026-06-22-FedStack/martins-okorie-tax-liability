import crypto from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib/functional";

const MFA_KEY_HEX = process.env.MFA_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Encrypt a string (e.g. TOTP secret) at rest using AES-256-GCM.
 * Format: iv:ciphertext:authTag
 */
export function encryptSecret(secret: string): string {
  const key = Buffer.from(MFA_KEY_HEX, "hex");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be a 32-byte (64 characters) hex string.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/**
 * Decrypt a string (e.g. TOTP secret) from GCM format.
 */
export function decryptSecret(encrypted: string): string {
  const key = Buffer.from(MFA_KEY_HEX, "hex");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be a 32-byte (64 characters) hex string.");
  }
  const [ivHex, encryptedHex, authTagHex] = encrypted.split(":");
  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error("Invalid encrypted secret format.");
  }
  const iv = Buffer.from(ivHex, "hex");
  const encryptedBytes = Buffer.from(encryptedHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedBytes, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface MfaEnrollmentResponse {
  secret: string;
  otpauthUri: string;
}

/**
 * Step 1: Generate MFA secret and provisioning URI.
 */
export function generateMfaSecret(email: string): MfaEnrollmentResponse {
  const secret = generateSecret();
  const otpauthUri = generateURI({
    issuer: "TaxPulse",
    label: email,
    secret
  });
  return { secret, otpauthUri };
}

/**
 * Step 2: Confirm enrollment with a valid current code.
 */
export async function confirmMfaEnrollment(secret: string, token: string): Promise<boolean> {
  const result = await verify({ token, secret });
  return result.valid;
}

const usedTokens = new Set<string>();

/**
 * Step 3: Challenge verifying a submitted code against an encrypted secret.
 * Enforces replay prevention to prevent reuse of TOTP tokens within the validity window (RFC 6238 §5.2).
 */
export async function verifyMfaCode(
  userId: string,
  encryptedSecret: string,
  token: string
): Promise<boolean> {
  const cacheKey = `${userId}:${token}`;
  if (usedTokens.has(cacheKey)) {
    return false;
  }

  try {
    const secret = decryptSecret(encryptedSecret);
    const result = await verify({ token, secret });
    if (result.valid) {
      usedTokens.add(cacheKey);
      // Clean up token from memory cache after 2 minutes
      setTimeout(() => usedTokens.delete(cacheKey), 120 * 1000);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}
