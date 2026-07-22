import { describe, expect, it } from "vitest";
import { generate } from "otplib/functional";

import { hashPassword, verifyPassword } from "../../src/auth/hashing.js";
import {
  confirmMfaEnrollment,
  decryptSecret,
  encryptSecret,
  generateMfaSecret,
  verifyMfaCode
} from "../../src/auth/mfa.js";

describe("Password Hashing & Verification (Argon2id)", () => {
  it("hashes password and verifies correctly, rejecting incorrect ones", async () => {
    const password = "my-secure-password-123";
    const wrongPassword = "wrong-password-123";

    const hash = await hashPassword(password);

    // Verify it is hashed and not plaintext
    expect(hash).not.toBe(password);
    expect(hash).toContain("$argon2id$");

    // Verify it passes validation with correct password
    const isCorrect = await verifyPassword(hash, password);
    expect(isCorrect).toBe(true);

    // Verify it fails validation with wrong password
    const isWrong = await verifyPassword(hash, wrongPassword);
    expect(isWrong).toBe(false);
  });
});

describe("AES-256-GCM Secret Encryption & Decryption", () => {
  it("successfully encrypts and decrypts secrets at rest", () => {
    const secret = "US6XJ552V3R4T75W";
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toBe(secret);
    expect(encrypted.split(":")).toHaveLength(3); // iv:ciphertext:authTag

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("throws error for malformed encrypted payload", () => {
    expect(() => decryptSecret("malformed-secret")).toThrow();
  });
});

describe("MFA (TOTP) Enrollment & Challenge Flow", () => {
  it("enrolls user TOTP secret, generates OTPURI, confirms, and verifies codes", async () => {
    const email = "advisor@taxpulse.com";
    const mfa = generateMfaSecret(email);

    expect(mfa.secret).toBeDefined();
    expect(mfa.otpauthUri).toContain("otpauth://totp/");
    expect(mfa.otpauthUri).toContain(encodeURIComponent(email));

    // Generate token from the secret using functional generate
    const token = await generate({ secret: mfa.secret });

    // Verify enrollment confirmation
    const isConfirmed = await confirmMfaEnrollment(mfa.secret, token);
    expect(isConfirmed).toBe(true);

    // Verify confirmation fails with wrong token
    const isWrongConfirmed = await confirmMfaEnrollment(mfa.secret, "000000");
    expect(isWrongConfirmed).toBe(false);

    // Encrypt secret for storage at rest
    const encryptedSecret = encryptSecret(mfa.secret);

    // Challenge validation
    const challengeSuccess = await verifyMfaCode("user-123", encryptedSecret, token);
    expect(challengeSuccess).toBe(true);

    // Challenge validation failure
    const challengeFailure = await verifyMfaCode("user-123", encryptedSecret, "000000");
    expect(challengeFailure).toBe(false);
  });
});
