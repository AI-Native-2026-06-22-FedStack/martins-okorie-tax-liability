# 3. Use Stateless Signed Tokens (JWTs) with RS256 and Separated Credentials

- Status: Proposed

## Context

TaxPulse is a multi-tenant SaaS built using a polyglot service architecture (Node.js/Express and Python/FastAPI). As the walking skeleton is extended with identity verification, both services must authenticate and authorize requests against a shared trust domain.

A central stateful session store (e.g., Redis or a shared database table) would couple the Express and FastAPI services to the same infrastructure layer and database schema. Additionally, storing password hashes and multi-factor authentication (MFA) secrets directly in the user profile table raises security risks (e.g., accidental serialization of hashes in API responses).

## Decision

1. **Stateless Tokens (JWTs) with RS256 signing**: We choose stateless JSON Web Tokens for authentication. To enable verification across services without sharing the power to mint tokens, we use the asymmetric **RS256** algorithm. The Express API holds the private key to sign tokens, while the FastAPI service holds only the public key to verify them.
2. **Key Rotation with `kid`**: Tokens carry a key ID (`kid`) in their headers, allowing verifiers to check tokens against multiple public keys. This ensures smooth key rotation without invalidating active sessions.
3. **Short-lived Access and Long-lived Refresh Tokens**: Access tokens expire in 15 minutes to limit the vulnerability window of a leaked token. Persisted, revocable refresh tokens support rotation and are used to request new access tokens.
4. **Credential and MFA Separation**: We store authentication secrets in tables separate from the primary `user` profile table:
   - `credential` contains the Argon2id password hash.
   - `mfa_enrollment` contains the TOTP secret and enrolled flag.
   - `refresh_token` contains persisted, revocable session metadata.

## Consequences

- **Stateless Decoupling**: Downstream services can verify identity claims completely offline, avoiding a database roundtrip or shared session store lookup for every request.
- **Asymmetric Trust**: Downstream services (e.g., FastAPI) cannot forge tokens because they do not have access to the private signing key.
- **Zero Plaintext Storage**: Plaintext passwords, TOTP secrets, or recovery codes are never stored in the database.
- **Accidental Leak Prevention**: User profile queries (e.g. email, status) do not accidentally retrieve password hashes or TOTP secrets, reducing SQL injection and serialization exposure.

## Alternatives Considered

- **Server-side Sessions (Redis/DB)**: Rejected. It would couple the Express and FastAPI services to a shared data store, increasing network latency and latency variability on hot request paths.
- **Symmetric signing (HS256)**: Rejected. HS256 requires both services to hold the exact same secret, which means a security breach or vulnerability in the downstream FastAPI service would allow it to mint fake tokens for the entire system.
- **Unified User Table (Profile + Hash + MFA)**: Rejected. Storing credentials alongside profile data violates the principle of separation of concerns and increases the risk of developer errors accidentally exposing credentials via API endpoints.
