import argon2 from "argon2";

/**
 * Hash a plaintext password with argon2id using costs read from environment.
 * The default parameters meet or exceed the OWASP baseline:
 * - memoryCost: 19456 KiB (19 MiB)
 * - timeCost: 2 iterations
 * - parallelism: 1 thread
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const memoryCost = parseInt(process.env.ARGON2_MEMORY_COST || "19456", 10);
  const timeCost = parseInt(process.env.ARGON2_TIME_COST || "2", 10);
  const parallelism = parseInt(process.env.ARGON2_PARALLELISM || "1", 10);

  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost,
    timeCost,
    parallelism
  });
}

/**
 * Verify a candidate password against a stored hash in a single constant-time call.
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch (error) {
    return false;
  }
}
