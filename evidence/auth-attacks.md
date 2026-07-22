# Auth attack regressions

## Forged tokens (each must be rejected)

1. **alg=none with admin roles**:

   - Forged Token: `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdHRhY2tlciIsInRlbmFudF9pZCI6IjMzMzMzMzMzLTMzMzMtNDMzMy04MzMzLTMzMzMzMzMzMzMzMyIsInJvbGUiOiJGaXJtIEFkbWluIiwiaXNzIjoidGF4cHVsc2UtYXBpIiwiYXVkIjoidGF4cHVsc2UtY2xpZW50cyJ9.`
   - Rejection Status: `401 Unauthorized`
   - Rejection Body:
     ```json
     {
       "type": "about:blank",
       "title": "Unauthorized",
       "status": 401,
       "detail": "An access token is required."
     }
     ```

2. **Wrong-key signature**:

   - Signed using a separate dynamically generated RSA private key not matching the verifier's registered public key.
   - Rejection Status: `401 Unauthorized`
   - Rejection Body:
     ```json
     {
       "type": "about:blank",
       "title": "Unauthorized",
       "status": 401,
       "detail": "An access token is required."
     }
     ```

3. **Unknown-user login**:
   - Request: `POST /auth/login`
     - Headers: `x-tenant-id: 33333333-3333-4333-8333-333333333333`
     - Body:
       ```json
       {
         "email": "unknown@taxpulse.com",
         "password": "some-password"
       }
       ```
   - Rejection Status: `401 Unauthorized`
   - Rejection Body:
     ```json
     {
       "type": "about:blank",
       "title": "Unauthorized",
       "status": 401,
       "detail": "Invalid credentials."
     }
     ```

## Allowlist proof

- **Verifier configuration test**: `apps/api/test/auth/tokens-verifier.test.ts` asserts that Passport's JWT strategy is configured with `algorithms: ["RS256"]`.
- **Forged-token rejection test**: `apps/api/test/auth/auth.attacks.test.ts` sends an `alg=none` bearer token to `POST /cycles` and asserts `401 Unauthorized`.
- **Mutation note**: with `jsonwebtoken` v9 and an RSA public key still present, deleting the explicit `algorithms: ["RS256"]` option does not make the `alg=none` token pass; the library rejects unsigned tokens before route handling. The executable regression therefore locks both the configured allowlist and the route-level rejection instead of claiming a bypass that this dependency version does not exhibit.

## MFA bypass regression

- **Pre-MFA temp-token rejection**: `apps/api/test/auth/tokens-verifier.test.ts` signs a token carrying `mfa_pending: true`, submits it as a bearer token to `POST /cycles`, and asserts `401 Unauthorized` with `Complete MFA before accessing this route.`
- **Guard behavior**: `requireAuth` rejects any token containing `mfa_pending` before assigning `req.user`, preventing a temporary MFA challenge token from satisfying protected cycle writes.

## Verification

- `npm run typecheck` from the repository root: passed.
- `npx vitest run apps/api/test/auth/tokens-verifier.test.ts apps/api/test/auth/auth.attacks.test.ts` from the repository root, outside the filesystem sandbox so Supertest can bind localhost: passed with `7 passed | 7 skipped`.
- `npm run test` from `apps/api`: blocked locally because no container runtime is available for Testcontainers and no `TAXPULSE_TEST_DATABASE_URL` is configured. The test setup now applies migrations against `TAXPULSE_TEST_DATABASE_URL` when provided, then falls back to Testcontainers.
