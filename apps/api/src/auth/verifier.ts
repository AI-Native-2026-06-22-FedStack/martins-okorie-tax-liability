import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";

import { getJwtConfig, getPublicKey } from "./tokens.js";

declare global {
  namespace Express {
    interface User {
      id: string;
      tenant_id: string;
      role: string;
    }
  }
}

/**
 * Configure the Passport JWT Strategy.
 * This pins the algorithm to RS256, uses the public key, and verifies the issuer/audience.
 */
export function initializePassport(): void {
  const { audience, issuer } = getJwtConfig();

  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: getPublicKey(),
        algorithms: ["RS256"],
        issuer,
        audience
      },
      (payload, done) => {
        if (!payload.sub || !payload.tenant_id || !payload.role) {
          return done(null, false, { message: "Invalid token claims structure." });
        }
        return done(null, {
          id: payload.sub,
          tenant_id: payload.tenant_id,
          role: payload.role
        });
      }
    )
  );
}

/**
 * Route guard middleware to protect endpoints.
 * Returns 401 Unauthorized in RFC 9457 Problem+JSON format on failure.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate("jwt", { session: false }, (err: unknown, user: Express.User | false, info: any) => {
    if (err || !user) {
      res.status(401).json({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: info?.message || "Valid access token is required."
      });
      return;
    }
    req.user = user;
    next();
  })(req, res, next);
}
