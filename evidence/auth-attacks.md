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
- **With `algorithms: ["RS256"]`**: the `alg=none` forged-token test passes and returns `401 Unauthorized` because the verifier strictly checks that the incoming algorithm is allowed.
- **Without the allowlist**: in older versions of libraries, the token header would be trusted, bypassing the signature verification and accepting the forgery. In modern versions (including the `jsonwebtoken` v9 engine used by `passport-jwt` here), even when `algorithms` is not specified, library-level checks require signature validation when a key is present, preventing the token from being accepted. Explicitly pinning the allowlist ensures this defense is locked down at the configuration level.
