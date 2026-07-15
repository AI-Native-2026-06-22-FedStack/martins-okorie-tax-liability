# Node Authentication And Authorization

# Entry 1

Asked — Store the Week 3 Day 1 Node Authentication & Authorization lesson content in `helper/` and start a new prompt journal on a new branch `m3d1-implementation`.

Produced — Switched to new branch `m3d1-implementation`, created `helper/week-3-day-1-node-authentication-authorization.md` containing the lesson content, and started `prompt-journal/0010-node-authentication-authorization.md`.

Accepted or rejected — Accepted.

Why — The user's request to store the lesson content and start a new prompt journal on the new branch was successfully completed.

# Entry 2

Asked — Extend the Drizzle schema in `apps/api/src/db/schema.ts` with identity/auth tables, generate a new forward migration, configure `.env.example`, write ADR-0003, and resolve the Zod/OpenAPI ESM hoisting error.

Produced — Created a side-effect module `extend-zod.ts` and loaded it first in `openapi.ts` to solve the Zod OpenAPI hoisting issue. Installed `argon2`, `jsonwebtoken`, `passport`, `passport-jwt` and their types. Created root `.env.example`. Extended the Drizzle schema with `role`, `user`, `credential`, `mfa_enrollment`, and `refresh_token` tables ensuring strict tenant isolation constraints and credential separation. Generated a new forward migration SQL file `0001_fearless_black_panther.sql` using `drizzle-kit generate`. Recorded the stateless-token and RS256 decisions in `docs/adr/0003-auth-and-session-model.md`. Verified that typechecks and tests compile and pass.

Accepted or rejected — Accepted.

Why — The Zod/OpenAPI import ordering bug was fixed, required packages were successfully installed, root configuration template was created, identity database schema was extended with proper isolation constraints, forward migration was generated, and architectural choices were documented in ADR-0003.

# Entry 3

Asked — Build the password hashing flow (`hashing.ts`) with Argon2id and the MFA enrollment/challenge flow (`mfa.ts`) with AES-256-GCM encrypted TOTP secrets. Create unit tests and verify they pass.

Produced — Created `apps/api/src/auth/hashing.ts` using Argon2id with explicit time, memory, and parallelism parameters. Created `apps/api/src/auth/mfa.ts` using `otplib/functional` for async TOTP operations and custom AES-256-GCM encryption for TOTP secrets at rest. Added unit tests in `apps/api/test/auth/hashing-mfa.test.ts` to test hashing verify/reject, GCM encryption/decryption, and TOTP enrollment/verification, and verified that all tests pass.

Accepted or rejected — Accepted.

Why — Hashing and MFA flow work perfectly: unit tests prove password hashing correctness (with Argon2id baseline: 19 MiB memory, 2 iterations, 1 parallelism, as recommended by OWASP Password Storage Cheat Sheet), secure GCM encryption of TOTP secrets at rest, and valid/invalid code validation.

# Entry 4

Asked — Build the token issuer (`tokens.ts`) and Passport-JWT verifier (`verifier.ts`), wire middleware to protect cycle write routes, and create integration tests.

Produced — Created `apps/api/src/auth/tokens.ts` for RS256 token generation and in-memory keypair fallback. Created `apps/api/src/auth/verifier.ts` setting up `JwtStrategy` (pinning algorithms to `["RS256"]`, checking issuer/audience/expiry) and route guard `requireAuth`. Wired passport initialization in `app.ts`, guarded `POST /cycles` route, and updated `createCycleController` to read tenant context from `req.user`. Added integration tests in `apps/api/test/auth/tokens-verifier.test.ts` and updated `problem-json.test.ts` to include auth headers. Verified all tests pass.

Accepted or rejected — Accepted.

Why — Token signing and verifier guard work perfectly: integration tests prove signature/claim/kid correctness, successful route access with valid tokens, and 401 rejection on unauthorized, tampered, or missing tokens.

# Entry 5

Asked — Create the auth attacks regression suite, implement TOTP replay prevention, implement login and mfa router and endpoints, and write the attacks evidence documentation.

Produced — Added TOTP token replay checks in `mfa.ts` using memory cache to prevent reuse of TOTP tokens within the validity window (RFC 6238 §5.2). Built `/auth/login` and `/auth/mfa` routes and controllers with timing-mitigation checks on passwords and dynamic token/refresh token issuance. Created `apps/api/test/auth/auth.attacks.test.ts` containing the regression tests for forged `alg=none` (assert 401), wrong key (assert 401), unknown user, wrong password, wrong TOTP, and replayed TOTP. Created `evidence/auth-attacks.md` documenting the results and confirming the algorithms allowlist checks. Verified all tests pass.

Accepted or rejected — Accepted.

Why — The complete regression suite runs and passes successfully, proving timing-attack and user-enumeration mitigation, replay prevention, and signature checks are correctly enforced.


