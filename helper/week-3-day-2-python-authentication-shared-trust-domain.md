# Week 3 · Day 2
Python Authentication & a Shared Trust Domain
Bring the FastAPI service into the same trust domain as Express — choose the Python JWT library, verify Express-issued RS256 tokens with a FastAPI dependency, hash passwords with pwdlib (Argon2), and prove a Node→Python protected call end-to-end.

## Topic 1 of 6
The Python auth landscape — choosing the JWT library
Why Do I Need to Know This?
Your FastAPI service has to verify the very tokens the Express service already issues, and the library you pick to do that decides how much security history you inherit. Python has several JWT libraries with very different maintenance and vulnerability records, and choosing the wrong one means re-litigating it after a CVE forces your hand. The team picks once, on the record, so both services stay consistent.

Scenario
Your team needs FastAPI to verify the RS256 tokens minted in Lesson 1, Node Authentication & Authorization. A teammate reaches for python-jose because an old tutorial used it; another points out that FastAPI’s own documentation moved to PyJWT, and that python-jose is a full JOSE implementation — more than this narrow job needs. The team compares the options against one job — verify a token with a public key and check its claims — and chooses the focused library FastAPI standardized on.

Theory
The job is narrow: verify, not a full OAuth framework
The FastAPI service is not minting tokens or running an OAuth server — it only needs to verify an RS256 token with a public key and check its claims. That narrow job favors a small, focused library over a full framework. Matching the verifier to the job keeps the dependency surface small, which matters for a federal review.

The candidates differ sharply in upkeep
Three libraries come up: PyJWT, python-jose, and Authlib.

Library	Scope	Fit for "verify a token"
PyJWT	Focused JWT encode/decode	Strong — small, current, what FastAPI’s docs use
python-jose	Full JOSE (JWE/JWS/JWK)	Works, but broader than a token-verify needs
Authlib	Full OAuth/OIDC framework	Overkill — far more than verification needs
All three can verify an RS256 token on Python 3.13. The distinction is fit and direction: FastAPI’s documentation moved to PyJWT, and python-jose is a full JOSE implementation (JWE/JWS/JWK) — more surface than a token-verify needs. python-jose also once carried an algorithm-confusion vulnerability, CVE-2024-33663, fixed in its 3.4.0 release — a reminder that pinning the algorithm matters whichever library you pick. Authlib is a capable framework but more than this job needs.

The program uses PyJWT
The team chooses PyJWT (≥ 2.8), which is what FastAPI’s own documentation now recommends after moving off python-jose. It decodes a token with a public key, takes an explicit algorithms allowlist (the same alg-pinning defense from Lesson 1, Node Authentication & Authorization), and verifies audience and issuer. The Example shows the one call that does the work.

Matching the library to the narrow verify job
The three libraries placed against the one job the FastAPI service has — verify an RS256 token — with PyJWT selected.

more than needed

overkill

Job: verify an RS256 token with a public key + check claims

PyJWT -- focused, maintained, current

python-jose -- full JOSE library, broader than needed

Authlib -- full OAuth/OIDC framework, more than needed

chosen

Example
verifying a token with pyjwt
import jwt  # the PyJWT package imports as `jwt`

# verify an RS256 token with the public key; pin the algorithm and check claims.
claims = jwt.decode(
    token,
    public_key,
    algorithms=["RS256"],          # (1) pin the algorithm — blocks alg=none / confusion
    audience="filing-clients",     # (2) must target our API
    issuer="filing-api",           # (3) must be our issuer
)
# claims["sub"], claims["roles"] are now trustworthy
Copy
Annotation (1) — algorithms=["RS256"] is the same defense as the Express verifier; PyJWT rejects any other alg, including none.
Annotation (2) and (3) — audience and issuer bind the token to this API and this issuer, so a validly signed token meant for something else is rejected.
jwt.decode raises a jwt.InvalidTokenError (or a subclass) on any failure; the Verifying Express’s tokens in FastAPI — the shared trust domain topic turns that into a 401.
AI Practice
Prompt it
Have Codex compare the libraries and recommend one, then verify the maintenance claims against current sources.

We have a FastAPI service that must verify RS256 JWTs issued by another service,
using a public key. Compare PyJWT, python-jose, and Authlib for this narrow
verification job and recommend one. Note the maintenance status and any known
CVEs of each, and whether each works on Python 3.13.
Copy
Watch out
Codex’s training data is full of older tutorials that use python-jose, so it may recommend it out of habit. That is not a runtime error — python-jose works on Python 3.13 — but it is broader than the verify job needs and is not what FastAPI’s docs use. It may also suggest Authlib without noting it is a full framework. Confirm the recommendation is PyJWT and that any maintenance or CVE claims are checked against current sources, not assumed.

Verify
Confirm the recommendation is PyJWT on accurate grounds: FastAPI standardized on it and it is the most focused fit for verifying a token, while python-jose is a broader JOSE library (and once carried CVE-2024-33663, fixed in 3.4.0). Reject any claim that python-jose is unmaintained or fails to import on Python 3.13 — neither is true as of its 3.5.0 release. Record the chosen library in your prompt journal so the ADR is consistent with the Node side.

Knowledge Check
1. Why does the team choose PyJWT over python-jose for the FastAPI verifier?
python-jose cannot verify RS256 tokens, only symmetric HS256 ones.
python-jose is unmaintained and fails to import on Python 3.13.
PyJWT is the focused library FastAPI’s docs use; python-jose is broader.
PyJWT is the only library that can check the audience and issuer claims.
2. What is the actual job the FastAPI service needs a JWT library for?
To run an OAuth2 authorization server that issues tokens to clients.
To encrypt the token payload so downstream services cannot read it.
To generate and rotate the RS256 signing keys for the platform.
To verify an RS256 token with a public key and check its claims.
3. Why does a narrow verification job favor PyJWT over Authlib?
PyJWT is small and focused on JWT verify/decode.
Authlib cannot verify RS256 tokens issued by a different service.
PyJWT is the only library that supports an algorithms allowlist.
Authlib stores the public key insecurely by default.
4. When jwt.decode is called with algorithms=["RS256"] and a token arrives with alg set to none, what happens?
The token is decoded, and the missing signature is treated as valid.
The token is accepted but flagged with a warning in the claims.
PyJWT raises an error because none is not in the allowlist.
PyJWT falls back to verifying the token with the public key as HS256.
2
Topic 2 of 6
FastAPI dependency injection for auth
Why Do I Need to Know This?
FastAPI expresses "this route requires a logged-in user" as a dependency the framework injects, so getting that one dependency right means every protected route reuses the same verified-identity check instead of each handler re-implementing it. A misplaced check is a route silently left open.

Scenario
Your team builds a get_current_user dependency: it extracts the bearer token with OAuth2PasswordBearer, verifies it, and returns the user — or raises a 401. Any route that declares user = Depends(get_current_user) is then protected automatically, so protecting the create-filing route is a one-line change.

Theory
Dependencies are functions FastAPI runs before the handler
Dependency injection in FastAPI means you declare a parameter as Depends(some_function), and FastAPI runs some_function first and passes its result in. A dependency that returns the current user — or raises — runs before the handler, so the handler only ever sees an authenticated request. This is the FastAPI equivalent of the Express middleware gate from Lesson 1, Node Authentication & Authorization.

OAuth2PasswordBearer extracts the token (only)
OAuth2PasswordBearer is a FastAPI security helper that pulls the token out of the Authorization: Bearer … header in a standard way. It does not validate the token — it only extracts the string. Validation is the job of the dependency that receives the extracted token and calls the verifier. Confusing "extracted" with "verified" is a classic way to ship an open route.

get_current_user makes protection declarative
The pattern is one dependency, get_current_user, that takes the extracted token, verifies it, and returns a User (or raises HTTPException(401)). A route protects itself by declaring user: User = Depends(get_current_user) — adding that parameter is the whole protection. The Example wires it into the create-filing route.

A request resolved through the auth dependency
OAuth2PasswordBearer extracts the token, get_current_user verifies it and returns the user, and only then does the route body run.

valid

invalid

Request: Authorization: Bearer ...

OAuth2PasswordBearer extracts the token string

get_current_user verifies + builds User

route body runs with user injected

raise HTTPException 401

Example
a get_current_user dependency protecting a route
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")  # (1) extracts the bearer token only

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    claims = verify_token(token)                        # (2) verify (shared-trust topic); raises on bad token
    return User(id=claims["sub"], roles=claims["roles"])

@app.post("/filings")
async def create_filing(
    body: CreateFiling,
    user: User = Depends(get_current_user),             # (3) declaring this protects the route
):
    return service.create(body, actor=user)
Copy
Annotation (1) — OAuth2PasswordBearer only extracts the token; it performs no verification on its own. The tokenUrl="login" argument only labels the token endpoint for the OpenAPI "Authorize" button in /docs — it does not make this service issue tokens; Express remains the issuer.
Annotation (2) — get_current_user calls the real verifier (the Verifying Express’s tokens in FastAPI — the shared trust domain topic) and raises on failure, so an invalid token never reaches the body.
Annotation (3) — adding user: User = Depends(get_current_user) is the entire protection for this route; forget it, and the route is open.
AI Practice
Prompt it
Ask Codex to build the dependency, then verify that extraction and verification are not conflated.

Write a FastAPI auth dependency get_current_user that uses OAuth2PasswordBearer
to extract the bearer token, calls a verify_token(token) function that raises on
an invalid token, and returns a User with id and roles. Protect a POST /filings
route with it using Depends. Raise HTTP 401 on failure.
Copy
Watch out
Codex sometimes treats OAuth2PasswordBearer as if it validates the token, returning the raw token as the "user" without verifying it — an open route that looks protected. It may also catch the verification error and return None instead of raising 401. Confirm get_current_user actually calls the verifier and raises on failure.

Verify
Call the protected route three ways: with no Authorization header (expect 401), with a malformed token (expect 401), and with a valid token (expect the route to run). If the malformed-token call succeeds, the dependency is extracting but not verifying. Record the result in your prompt journal.

Knowledge Check
1. What does OAuth2PasswordBearer actually do in the auth flow?
It verifies the token’s signature and returns the decoded claims.
It issues a new access token from a username and password.
It extracts the bearer token string from the request header.
It stores the token in a server-side session for later lookup.
2. How does a FastAPI route declare that it requires an authenticated user?
By adding a user = Depends(get_current_user) parameter.
By calling get_current_user() manually on the first line of the body.
By decorating the route with @requires_auth above the path operation.
By listing the route path in a global protected-routes config file.
3. Why is it dangerous to treat the output of OAuth2PasswordBearer as the authenticated user?
Because the extracted token is always expired by the time it is read.
Because the header may contain several tokens and only one is valid.
Because the token is only extracted, not verified, so the route is open.
Because the user’s roles are stored separately and must be fetched first.
4. A dependency catches the verification error and returns None instead of raising. What is the consequence?
The route returns a clean 401, since None signals an unauthenticated user.
The route runs with a None user instead of rejecting the request.
FastAPI automatically converts a None return into a 403 response.
The token is re-extracted and verification is retried once more.
3
Topic 3 of 6
Verifying Express's tokens in FastAPI — the shared trust domain
Why Do I Need to Know This?
The whole point of RS256 was that one identity could work across both services, and that promise is only kept if the FastAPI verifier accepts exactly the tokens Express issues — same algorithm, same issuer and audience, the right key by id. A verifier that is even slightly looser is a hole; one that is slightly stricter rejects valid users.

Scenario
Your team configures the FastAPI verifier with Express’s public key, pins the algorithm to RS256, and checks the same issuer and audience Express stamped in Lesson 1, Node Authentication & Authorization. It selects the key by the kid in the token header, matching Lesson 1’s rotation design, then proves a token Express minted is accepted by a FastAPI route.

Theory
Shared trust means the public key, the algorithm, and the claims all match
A shared trust domain is a precise agreement: the verifier holds the issuer’s public key (never the private key), pins the same algorithm (RS256), and checks the same issuer and audience the issuer set. Any mismatch breaks it in one of two ways — too loose accepts foreign tokens, too strict rejects valid ones. The verifier mirrors the issuer exactly.

The kid selects the right public key
Lesson 1, Node Authentication & Authorization put a key id (kid) in each token header so verifiers can hold several public keys during rotation. The FastAPI verifier reads the unverified header, looks up the public key for that kid, and verifies with it. This is what lets a key rotate on the Express side without the FastAPI side rejecting in-flight tokens.

!
Warning
The verifier must hold only the public key. If the FastAPI service ever holds the RS256 private key, it can mint tokens too — collapsing the "verify but cannot forge" property that justified RS256 in the first place.

A failed verification is a 401, not a 500
Every way a token can fail — bad signature, wrong aud/iss, expired, unknown kid — is a client problem, so the verifier raises a 401, not a 500. Catching PyJWT’s InvalidTokenError and re-raising as HTTPException(401) keeps a forged or stale token from looking like a server crash.

Express issues, FastAPI verifies with the public key
A token minted by Express is accepted by FastAPI when the key, algorithm, and claims match; a token from another issuer is rejected.

FastAPI (verifier, public key)
Client
Express (issuer, private key)
token signed RS256, kid=2026-06, iss=filing-api, aud=filing-clients
1
GET /py/filings (Bearer token)
2
pick public key by kid, verify RS256 + iss + aud
3
200 (claims trusted)
4
token with iss=other (Bearer)
5
401 (issuer mismatch)
6
Example
the fastapi verifier mirroring the express issuer
import jwt
from fastapi import HTTPException, status

PUBLIC_KEYS = {"2026-06": CURRENT_PUBLIC_PEM, "2026-03": OLD_PUBLIC_PEM}  # (1) keys by kid

def verify_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)        # (2) read kid before verifying
    key = PUBLIC_KEYS.get(header.get("kid"))
    if key is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown key id")
    try:
        return jwt.decode(
            token, key,
            algorithms=["RS256"],                    # (3) same algorithm as Express
            audience="filing-clients", issuer="filing-api",  # (4) same claims as Express
        )
    except jwt.InvalidTokenError:                    # (5) any failure -> 401, not 500
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
Copy
Annotation (1) — only public keys are held, keyed by kid, so the service can verify but never mint.
Annotation (2) — the kid is read from the unverified header only to select the key; the signature is still checked in decode.
Annotation (3) and (4) — pinning RS256 and checking issuer/audience makes the verifier accept exactly the tokens Express issues.
Annotation (5) — every failure mode collapses to a 401, so a bad token is a client error, not a server fault.
AI Practice
Prompt it
Have Codex write the verifier, then prove parity by running a real Express-issued token through it.

Write a FastAPI verify_token(token) using PyJWT that: reads the kid from the
header and selects the matching RS256 public key, decodes with
algorithms=["RS256"], and verifies audience "filing-clients" and issuer
"filing-api". Raise HTTP 401 on any failure. Assume only public keys are
available, keyed by kid. Mirror the Express verifier exactly.
Copy
Watch out
Codex may drop the audience/issuer checks (the token "still decodes"), accept any alg, or — worst — load a private key "to be safe." It may also return None on failure instead of raising 401. Confirm only public keys are used, the algorithm and claims match Express, and failures raise 401.

Verify
Take a token actually minted by the Express issuer (or the shared test key) and confirm verify_token accepts it and returns the right sub. Then tamper with one field — change audience, or sign with a different key — and confirm it raises 401. This parity check is the real proof the trust domain is shared, which the Proving one trust domain across two languages topic locks into a test.

Knowledge Check
1. Why must the FastAPI verifier hold only the public key, never the private key?
The private key is too large to load efficiently in a Python process.
Verification is mathematically impossible with a private key present.
FastAPI refuses to start if a private key is found in the environment.
Holding the private key lets the service mint tokens, not just verify.
2. What is the kid in the token header used for during verification?
To prove the token has not yet expired before decoding it.
To select which public key to verify the token’s signature with.
To identify which user the token was issued to.
To choose the algorithm the verifier should accept for this token.
3. The FastAPI verifier decodes a token’s signature successfully but skips the issuer and audience checks. What is the risk?
A validly signed token meant for another service would be accepted.
The token’s signature would silently be treated as invalid.
The verifier would be unable to read the user’s roles from the claims.
PyJWT would raise an error because iss and aud are required.
4. A forged token reaches verify_token and fails the signature check. What should the function do?
Return an empty claims dict so the route can decide what to do.
Log the failure and return the unverified claims for debugging.
Raise a 500 error, since a bad signature is an unexpected condition.
Raise an HTTP 401, treating the failure as a client error.
4
Topic 4 of 6
Password hashing in Python with pwdlib (Argon2)
Why Do I Need to Know This?
The Python service must hash passwords with the same posture as the Node service — Argon2id, a specific variant of Argon2, never a fast hash — or the security bar drops the moment a request crosses the language line. And the library matters: the obvious choice from older tutorials no longer runs on the program’s Python, so picking the right one is part of getting this correct.

Scenario
Your team adds credential hashing to the FastAPI service. A teammate copies a tutorial that uses passlib; it imports fine, but the hash call fails at runtime on Python 3.13 because the crypt module it relies on is gone. The team switches to pwdlib with Argon2 — the maintained replacement — configured to the same Argon2id posture as the Node side, so the password policy is uniform across both services.

Theory
passlib is unmaintained and unreliable on Python 3.13 — use pwdlib
The long-standing passlib library is effectively unmaintained — its last release was 2020 — and it is unreliable on the program’s locked Python 3.13. The standard-library crypt module it uses for several schemes was removed in 3.13, so those schemes fail at runtime, and its bcrypt backend has known breakage on recent versions. The import itself still succeeds, which is what makes the breakage easy to miss until a hash call fails. The maintained replacement is pwdlib (adopted by FastAPI Users), which supports Argon2 and bcrypt with a small hash/verify API. The team uses pwdlib with Argon2.

Argon2 keeps parity with the Node side
pwdlib with PasswordHash.recommended() selects Argon2, which is the same Argon2id family the Express service hashes with in Lesson 1, Node Authentication & Authorization. Keeping the same algorithm and a comparable cost posture means a password is held to the same standard whichever service stores it. The libraries differ; the posture does not.

pwdlib handles salting and verification
As with the Node library, you never write the salting or comparison yourself: pwdlib generates a per-password salt, embeds the parameters in the hash string, and verifies in one call. The rule is the same in both languages — hash with the library, store the hash, verify with the library, and never reach for a fast hash or the unmaintained passlib.

Storing and checking a password in FastAPI
Signup hashes the password with Argon2 via pwdlib; login verifies a candidate against the stored hash — the same shape as the Node side.

Signup: plaintext password

pwdlib PasswordHash.recommended() -> Argon2 hash

store the hash (never the password)

Login: candidate password

password_hash.verify(candidate, stored)

True -> allow / False -> deny

Example
hashing and verifying with pwdlib
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()        # (1) Argon2-based, sensible defaults

# (2) hash at signup — salt and parameters are embedded in the returned string
hashed = password_hash.hash(plaintext_password)

# (3) verify at login — one call, no decryption
if not password_hash.verify(candidate_password, hashed):
    raise HTTPException(status_code=401, detail="invalid credentials")
Copy
Annotation (1) — PasswordHash.recommended() selects Argon2, keeping Argon2id parity with the Node service; never substitute passlib, which is unmaintained and unreliable on Python 3.13.
Annotation (2) — hash generates a per-password salt and embeds it with the parameters, so the stored string is self-describing.
Annotation (3) — verify(candidate, hashed) re-derives and compares; a mismatch is a 401, not a 500.
AI Practice
Prompt it
Have Codex set up pwdlib Argon2 hashing, then verify it did not fall back to the broken library.

Set up password hashing in a FastAPI service using pwdlib with Argon2
(PasswordHash.recommended()). Write a hash-at-signup and verify-at-login pair,
raising HTTP 401 on a failed verify. Keep the Argon2 posture consistent with our
Node service's Argon2id. Do not use passlib.
Copy
Watch out
Codex very often reaches for passlib’s CryptContext because countless tutorials use it — but passlib is unmaintained, and its crypt-based schemes fail at runtime on Python 3.13 (the import still succeeds, which hides the problem). It may also pick bcrypt instead of Argon2, breaking parity with the Node side. Confirm the code imports pwdlib, selects Argon2, and contains no passlib.

Verify
Confirm the import is pwdlib (not passlib) and the hasher is Argon2. Run the roundtrip on Python 3.13: hash a password, verify the correct one returns True and a wrong one returns False. If Codex used passlib, replace it — it is unmaintained, and its crypt-based schemes fail at runtime on 3.13 even though the import succeeds. Record the library choice in your prompt journal.

Knowledge Check
1. Why does the program use pwdlib instead of passlib?
passlib is unmaintained and unreliable on Python 3.13.
pwdlib is the only Python library that can produce Argon2 hashes.
passlib cannot generate a per-password salt, while pwdlib can.
pwdlib stores passwords in plaintext for faster verification.
2. Why configure pwdlib to use Argon2 specifically in the FastAPI service?
Argon2 is the only algorithm pwdlib is able to verify.
Argon2 lets the service skip storing a salt with each hash.
It keeps Argon2id parity with the Node service’s posture.
Argon2 hashes are reversible, which simplifies password recovery.
3. What does password_hash.verify(candidate, hashed) do?
It decrypts the stored hash back to the original password to compare.
It re-derives the hash from the candidate and compares it.
It looks the password up in a table of known-good credentials.
It returns the stored parameters so the caller can compare them manually.
4. Codex generates FastAPI hashing code using passlib’s CryptContext. What happens on Python 3.13, and what should you do?
It runs fine, since passlib is fully supported on Python 3.13.
It runs but silently produces weaker hashes than Argon2.
It works only if you also install the crypt module from PyPI.
It relies on an unmaintained library; replace it with pwdlib.
5
Topic 5 of 6
Proving one trust domain across two languages
Why Do I Need to Know This?
"Shared trust domain" is a claim, and an unverified claim drifts the first time someone rotates a key or changes an audience. A single contract test — a token minted on the Express side, verified on the FastAPI side — turns the claim into something the build proves on every run.

Scenario
Your team writes a contract test: a token signed with the shared key fixture (the same key Express signs with) is accepted by the FastAPI verify_token, and a token with the wrong audience is rejected. The test lives in the suite, so the day someone changes the audience on one side and not the other, it goes red.

Theory
A contract test exercises both sides' agreement
A cross-service contract test mints a token the way the issuer does and runs it through the real verifier, so it checks the actual agreement — algorithm, issuer, audience, key — rather than each service’s view of it in isolation. A single-service test can pass on both sides while the two disagree; only a contract test catches that.

Test both the success and the failure path
The test must assert the valid shared token is accepted and that a deliberately wrong token (wrong aud, wrong iss, or expired) is rejected. The failure path is what proves the verifier is actually checking, not just returning success. Asserting only the happy path would pass even against a verifier that accepts everything.

The shared key fixture is the single source
Both services’ tests verify against one shared key fixture — the same key pair Express signs with and FastAPI verifies against. Keeping it in one place means the test is exercising the real trust relationship, not two copies that can quietly diverge. This is the shared key fixture the team commits for the capstone.

The contract test drives issue-then-verify
The test mints with the shared key and asserts FastAPI accepts it; it mints a wrong-audience token and asserts FastAPI rejects it.

FastAPI verify_token
Contract test
token signed with shared key, aud=filing-clients
1
claims (accepted)
2
token signed with shared key, aud=wrong
3
HTTP 401 (rejected)
4
Example
a cross-service contract test in pytest
import pytest
from fastapi import HTTPException
from auth import verify_token

# express_token / wrong_aud_token are signed with the SHARED key fixture,
# exactly as the Express issuer signs (RS256, kid, iss="filing-api").
def test_fastapi_accepts_an_express_issued_token(express_token):
    claims = verify_token(express_token)        # (1) success path
    assert claims["sub"] == "u_1"

def test_fastapi_rejects_a_wrong_audience_token(wrong_aud_token):
    with pytest.raises(HTTPException) as err:   # (2) failure path
        verify_token(wrong_aud_token)
    assert err.value.status_code == 401
Copy
Annotation (1) — the success path proves a token minted the way Express mints it is accepted, with the expected sub.
Annotation (2) — the failure path proves the verifier actually checks audience; without the iss/aud checks from the previous topic, this test would fail.
Both tokens come from the shared key fixture, so the test exercises the real cross-service trust relationship rather than a mock of it.
AI Practice
Prompt it
Have Codex write the contract test, then confirm it covers a failure path and uses the real verifier.

Write pytest tests for our FastAPI verify_token that prove a shared trust domain
with Express. Use a shared RS256 key fixture (the same key the Express issuer
signs with) to mint test tokens. Assert that a correctly-issued token
(iss=filing-api, aud=filing-clients) is accepted and returns the right sub, and
that a token with the wrong audience raises HTTP 401. Do not mock verify_token.
Copy
Watch out
Codex may mock verify_token itself (proving nothing), assert only the happy path, or mint the test token with different claims than Express actually uses — so the test passes but does not reflect the real issuer. Confirm the test calls the real verifier, uses the shared key and the real iss/aud, and includes the rejection case.

Verify
Run both tests and confirm they pass. Then prove the failure test is real: temporarily drop the audience check from verify_token and confirm the wrong-audience test fails (it now wrongly accepts). Restore the check. Confirm the success test mints with the same iss/aud/kid Express uses — closed-book, be ready to explain what the aud claim is for without AI.

Knowledge Check
1. What does a cross-service contract test prove that a single-service test cannot?
That the FastAPI service is faster than the Express service at verification.
That a token minted the issuer’s way is accepted by the real verifier.
That the Express service’s private key is stored securely at rest.
That the database round-trip for a filing completes within budget.
2. Why must the contract test include a wrong-audience (failure) case, not just the happy path?
Because pytest requires at least two assertions per test file.
Because the rejection proves the verifier is actually checking claims.
Because the wrong-audience token is what real clients usually send.
Because a 401 response is required to generate the OpenAPI error schema.
3. Why do both services’ tests verify against one shared key fixture?
So the test exercises the real trust relationship, not two copies.
Because RS256 requires the public and private keys to be in the same file.
Because generating a key pair per test would be too slow to run in CI.
Because the fixture is the only place the production signing key is stored.
4. A contract test mocks verify_token and asserts it returns the expected claims. What is wrong with it?
Nothing — mocking the verifier makes the test faster and more reliable.
It will fail because a mock cannot return a claims dictionary.
It proves nothing, because the real verification path never runs.
It tests the failure path but never the success path.
6
Topic 6 of 6
Practice — prove a token crosses the language line
Why Do I Need to Know This?
This lesson’s payoff is one identity working across two languages, and the only way to know it holds is to mint a token on the Node side and watch the Python side accept it — then watch it reject a tampered one. This exercise has you drive Codex to build the FastAPI verifier and the contract test, then verify the trust domain is real by attacking it, which is the verify-don’t-trust loop applied across the service boundary.

Theory
Codex can write the verifier and the contract test quickly; it cannot confirm they are correct. That confirmation is the attack in the verify step below — tampering with a real token and watching the rejection happen — which is the only proof that the trust domain holds and not just that the code compiles.

AI Practice
Prompt it
Hands-on practice for this lesson — build the FastAPI side with Codex, then prove a real Express-issued token verifies and a tampered one does not.

In my FastAPI service, add: password hashing with pwdlib (Argon2, no passlib), a
verify_token(token) using PyJWT that selects the RS256 public key by kid and
checks issuer "filing-api" and audience "filing-clients", and a get_current_user
dependency that protects one route. Then write pytest contract tests using a
shared RS256 key fixture that mint a token the way the Express issuer does:
assert a valid token is accepted and a wrong-audience token raises HTTP 401.
Copy
Watch out
Codex is likely to reach for passlib (unmaintained, with crypt-based schemes that break at runtime on Python 3.13) and python-jose (a broader JOSE library than this needs), to drop the issuer/audience checks, or to mock the verifier in the contract test. Each one passes a shallow check while leaving the trust domain unproven or the password posture on shaky ground. Read the imports and the verifier options before trusting the green checks.

Verify
Run the contract tests on Python 3.13 and confirm both pass (valid accepted, wrong-audience rejected). Then prove they are real: drop the audience check and confirm the rejection test fails, then restore it; confirm the hashing import is pwdlib, not passlib. Take a token actually minted by your Express issuer from Lesson 1, Node Authentication & Authorization and confirm FastAPI accepts it. Record anything Codex got wrong in your prompt journal for the shared-trust ADR.
