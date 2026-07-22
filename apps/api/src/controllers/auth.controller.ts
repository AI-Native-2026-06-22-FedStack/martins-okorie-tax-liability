import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

import { verifyPassword } from "../auth/hashing.js";
import { verifyMfaCode } from "../auth/mfa.js";
import {
  generateRefreshTokenString,
  getJwtConfig,
  getPublicKey,
  hashRefreshToken,
  signAccessToken,
  signTempMfaToken
} from "../auth/tokens.js";
import { getDb } from "../db/client.js";
import { credential, mfaEnrollment, refreshToken, role, user } from "../db/schema.js";

// A dummy hash to run argon2 against for non-existent users
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$abcdefghijklmnopqrstuvwxyz012345678901234";

/**
 * Handle POST /auth/login request.
 * Resolves password check and returns a temporary MFA token on success.
 */
export async function loginController(req: Request, res: Response): Promise<void> {
  const tenantId = req.get("x-tenant-id") || req.body.tenant_id;
  const { email, password } = req.body;

  if (!tenantId || !email || !password) {
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials."
    });
    return;
  }

  const db = getDb();

  // 1. Fetch user & role
  const users = await db
    .select({
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      roleName: role.name
    })
    .from(user)
    .innerJoin(role, eq(user.role_id, role.id))
    .where(and(eq(user.tenant_id, tenantId), eq(user.email, email)))
    .limit(1);

  const foundUser = users[0];

  if (!foundUser) {
    // Timing attack mitigation: run password verify on a dummy hash
    await verifyPassword(DUMMY_HASH, password);
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials."
    });
    return;
  }

  // 2. Fetch user credentials
  const creds = await db
    .select()
    .from(credential)
    .where(and(eq(credential.tenant_id, tenantId), eq(credential.user_id, foundUser.id)))
    .limit(1);

  const cred = creds[0];
  if (!cred) {
    await verifyPassword(DUMMY_HASH, password);
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials."
    });
    return;
  }

  // 3. Verify password
  const isValid = await verifyPassword(cred.password_hash, password);
  if (!isValid) {
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials."
    });
    return;
  }

  // 4. Return temporary MFA token
  const tempToken = signTempMfaToken({
    sub: foundUser.id,
    tenant_id: foundUser.tenant_id,
    role: foundUser.roleName
  });

  res.json({
    mfaRequired: true,
    tempToken
  });
}

/**
 * Handle POST /auth/mfa request.
 * Verifies tempToken and TOTP code (enforcing replay checks) and issues access + refresh tokens.
 */
export async function mfaController(req: Request, res: Response): Promise<void> {
  const { tempToken, code } = req.body;

  if (!tempToken || !code) {
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials."
    });
    return;
  }

  try {
    const { audience, issuer } = getJwtConfig();

    // 1. Decode and verify temporary token
    const decoded = jwt.verify(tempToken, getPublicKey(), {
      algorithms: ["RS256"],
      issuer,
      audience
    }) as any;

    if (!decoded.mfa_pending || !decoded.sub || !decoded.tenant_id || !decoded.role) {
      res.status(401).json({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid credentials."
      });
      return;
    }

    const userId = decoded.sub;
    const tenantId = decoded.tenant_id;
    const roleName = decoded.role;

    const db = getDb();

    // 2. Fetch MFA secret
    const enrollments = await db
      .select()
      .from(mfaEnrollment)
      .where(and(eq(mfaEnrollment.tenant_id, tenantId), eq(mfaEnrollment.user_id, userId)))
      .limit(1);

    const enrollment = enrollments[0];
    if (!enrollment || !enrollment.enrolled) {
      res.status(401).json({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid credentials."
      });
      return;
    }

    // 3. Verify MFA code (enforcing replay checks)
    const isMfaValid = await verifyMfaCode(userId, enrollment.totp_secret, code);
    if (!isMfaValid) {
      res.status(401).json({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid credentials."
      });
      return;
    }

    // 4. Generate & persist refresh token
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(refreshToken).values({
      tenant_id: tenantId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    // 5. Sign access token
    const accessToken = signAccessToken({
      sub: userId,
      tenant_id: tenantId,
      role: roleName
    });

    res.json({
      accessToken,
      refreshToken: rawRefreshToken
    });
  } catch (error) {
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials."
    });
  }
}
