# Prompt Journal: Week 3 · Day 2 Python Authentication & a Shared Trust Domain

## Entry 1

Asked — Setup helper file with instructions and initialize new journal.

Produced — Created `helper/week-3-day-2-python-authentication-shared-trust-domain.md` and initialized this journal.

Accepted or rejected — Accepted.

Why — Instructions stored for reference and new journal bootstrap successful.

# Entry 2

Asked — Scaffold the compute service under `services/compute` with FastAPI, PyJWT, and pwdlib (Argon2), configure key retrieval fallback logic, and implement a protected compute endpoint.

Produced — Created a new `uv` project. Configured `pyproject.toml` with the specified dependencies. Created `services/compute/app/auth.py` implementing `UserIdentity` (Pydantic context), `verify_token` (decodes with RS256 algorithm constraint, audience and issuer checks), `get_current_user` dependency (OAuth2PasswordBearer extractor), and password hashing via `pwdlib` (Argon2id). Created `services/compute/app/main.py` initializing FastAPI and protecting `/compute/tax-liability` using the dependency.

Accepted or rejected — Accepted.

Why — Python 3.13 microservice project structure bootstrapped cleanly and verifier + hashing + routing logic successfully implemented.

# Entry 3

Asked — Ensure password verification helper raises an HTTP 401 Unauthorized status code instead of returning False on failed checks.

Produced — Modified `verify_password` inside `services/compute/app/auth.py` to catch hashing errors or invalid credentials and raise a `fastapi.HTTPException(status_code=401)` response instead of returning `False`.

Accepted or rejected — Accepted.

Why — Password verification helper now correctly raises a 401 Unauthorized response on check failures, satisfying the security contract.

# Entry 4

Asked — Generate a shared RS256 key pair, write conftest token-minting fixtures, create the cross-service contract test, and add pytest configuration.

Produced — Created a shared RS256 key pair (private.pem, public.pem) under `services/compute/tests/fixtures/jwt_keys/` using OpenSSL. Created `services/compute/tests/conftest.py` containing session fixtures to generate valid, wrong-audience, expired, and tampered tokens matching the Express signing claims. Created `services/compute/tests/test_trust_domain.py` containing 9 contract test cases validating success and failure verification paths, route access, and password hashing check behaviors. Configured the `pythonpath` tool setting in `services/compute/pyproject.toml` to dynamically resolve modules.

Accepted or rejected — Accepted.

Why — Cross-service contract test suite runs and passes cleanly on Python 3.13, validating the shared trust domain signature and claim assertions.

# Entry 5

Asked — Review the approved M3D2 PR feedback and handle the non-blocking cleanup items around machine-specific key fallback paths, nominal `kid` handling, and wrong-issuer coverage.

Produced — Removed the hardcoded local filesystem path from the compute service public-key fallback, resolved fixture keys through repo-relative `Path` locations, enforced the configured single-key `kid` via `JWT_PUBLIC_KEY_KID` before loading the fallback key, and added a wrong-issuer token fixture plus regression test.

Accepted or rejected — Accepted.

Why — The compute trust-domain test suite passes with 10 tests, including wrong-audience and wrong-issuer rejection, and key lookup no longer depends on a developer-specific absolute path.
