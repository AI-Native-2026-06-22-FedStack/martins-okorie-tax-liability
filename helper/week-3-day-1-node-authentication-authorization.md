# Week 3 · Day 1: Node Authentication & Authorization

Add language-native JWT auth to the Express service — authentication vs authorization, access and refresh tokens, RS256 signing with rotatable keys, a passport-jwt verifier, and argon2id password hashing — and the attack regressions that prove it holds.

## Topic 1 of 6: AuthN vs AuthZ, sessions vs tokens, and access vs refresh

### Why Do I Need to Know This?
Every route your team protects this week rests on two separate questions: who is calling (authentication) and what are they allowed to do (authorization). Treating them as one check bakes a security flaw into every endpoint, and choosing the wrong session model now forces a rewrite when the FastAPI service has to verify the same identity. Your team settles the model before writing a single verifier, because both services will depend on it.

### Scenario
The walking skeleton your team shipped in Module 2 has open routes — anyone who knows the URL can create a filing. One engineer proposes checking a password on every request; another wants server-side sessions stored in the database. Your team instead chooses stateless tokens: a short-lived access token sent on every request and a long-lived refresh token exchanged for new access tokens. The deciding factor is that the FastAPI service in 3.2 Python Authentication & a Shared Trust Domain must verify the same identity without sharing a session store.

### Theory
#### Authentication and authorization are different checks
Authentication answers "who are you?"; authorization answers "what may you do?". A protected route needs both, in that order: first confirm the identity, then confirm that identity has the right to the action. Collapsing them — for example, treating "has a valid token" as "may delete any filing" — is how privilege bugs ship. The Example shows the two checks as separate steps.

#### Sessions store state on the server; tokens carry it signed
A session-based model stores the login state on the server and hands the client an opaque id; every request looks that id up. A token-based model hands the client a signed token that carries the identity, so any service holding the verification key can check it without a shared lookup. Your team picks tokens because two services in two languages must both verify the same identity, and a shared session store would couple them. The signature is what makes a carried token trustworthy (covered in the next topic).

#### Access tokens are short-lived; refresh tokens renew them
An access token is sent on every request and is deliberately short-lived (minutes), so a leaked one expires quickly. A refresh token lives longer, is stored more carefully, and is used only to obtain new access tokens when they expire. Splitting them limits the damage of a leaked access token without forcing the user to log in every few minutes.

#### Login, a protected request, and a refresh
Login returns both tokens; a protected request carries the access token; when it expires, the refresh token buys a new one.

```
Express API                                  Client
    |                                          |
    |<-- POST /login (credentials) ------------|
    |                                          |
    |-- access token (15m) + refresh token --->|
    |                                          |
    |<-- POST /filings (Auth: Bearer access) --|
    |                                          |
    |-- 201 Created -------------------------->|
    |                                          |
    |<-- POST /filings (expired access) -------|
    |                                          |
    |-- 401 Unauthorized --------------------->|
    |                                          |
    |<-- POST /refresh (refresh token) --------|
    |                                          |
    |-- new access token --------------------->|
```

### Example: authentication then authorization, as two steps
```typescript
type AuthClaims = { sub: string; roles: string[]; aud: string; exp: number };

// (1) authentication: is there a verified identity at all?
// (2) authorization: does that identity hold the required role?
function requireRole(claims: AuthClaims | null, role: string): AuthClaims {
  if (!claims) throw new UnauthorizedError();              // 401 — who are you?
  if (!claims.roles.includes(role)) throw new ForbiddenError(); // 403 — you may not
  return claims;
}
```
* **Annotation (1)** — a missing or unverified identity is a 401 (authentication failed); the request never reaches the authorization check.
* **Annotation (2)** — a verified identity that lacks the role is a 403 (authorization check failed); the distinction matters because 401 and 403 tell the client different things.
* The claims object is the verified token payload from the verifier (next two topics); this function assumes the signature was already checked.

### AI Practice
#### Prompt it
Have Codex contrast the two session models for a polyglot system, then verify its recommendation against your constraint.
> We run two services — an Express API and a FastAPI service — that must both verify the same user identity. Compare server-side sessions versus stateless signed tokens for this setup, and recommend one. Explain how each option handles a second service verifying the identity, and call out the trade-off you are accepting.

#### Watch out
Codex often recommends sessions by default because they are the most common single-service pattern, without weighing the two-service constraint. It may also blur access and refresh tokens into "a token." Confirm the recommendation accounts for a second service verifying without a shared store, and that it keeps access and refresh tokens distinct.

#### Verify
Check that the recommendation is stateless tokens for this polyglot case, and that the rationale names the real trade-off (no central revocation list, so short access-token lifetimes matter). If it recommends sessions, ask it how the FastAPI service would verify identity without sharing the session store — the answer exposes the coupling. Record the decision in your prompt journal for ADR-0003.

### Knowledge Check
1. A request arrives with a valid, verified token, but the user lacks permission for the action. Which response is correct, and why?
   * **Answer**: `403 Forbidden`, because the identity is known but lacks the right.
2. Why did the team choose stateless tokens over server-side sessions for this system?
   * **Answer**: A second service can verify a signed token without sharing a session store.
3. What is the purpose of pairing a short-lived access token with a long-lived refresh token?
   * **Answer**: A leaked access token expires fast; the refresh token avoids re-login.
4. A teammate proposes treating "the request has a valid token" as sufficient to delete any filing. What is wrong with that?
   * **Answer**: It conflates authentication with authorization, skipping the permission check.

---

## Topic 2 of 6: JWT structure, signing, and key rotation

### Why Do I Need to Know This?
A token is only trustworthy because of its signature, and the choice between a shared secret and a key pair decides whether your second service can verify tokens without holding the power to mint them. Key rotation decides whether a leaked or aging key is a routine swap or a production incident. Your team has to get both right before the FastAPI service joins the trust domain in 3.2 Python Authentication & a Shared Trust Domain.

### Scenario
Your team needs the FastAPI service to verify Express’s tokens without sharing Express’s signing secret — because a shared secret means either service could forge tokens. They choose RS256: Express signs with a private key, and any verifier holds only the public key. They add a key id to each token’s header so a key can be rotated out gradually without invalidating tokens already in flight.

### Theory
#### A JWT is three parts, and only the signature is trust
A JWT has three dot-separated parts: a header (which algorithm and key), a payload of claims (sub, roles, aud, exp, …), and a signature. The header and payload are merely base64url-encoded, not encrypted — anyone can read them. Only the signature is the security boundary: it proves the token was issued by a holder of the signing key and has not been altered. Trusting the readable payload without checking the signature is the root of most JWT attacks.

#### HS256 shares a secret; RS256 splits sign from verify
HS256 signs and verifies with one shared secret — whoever can verify can also sign. RS256 signs with a private key and verifies with the matching public key, so a verifier that holds only the public key can check tokens but cannot mint them. Your team picks RS256 precisely because the FastAPI service must verify but must not be able to forge — a property HS256 cannot give across two services.

> [!WARNING]
> With HS256, handing the secret to a second service so it can verify also hands it the power to issue tokens. When a separate party must verify not mint, use an asymmetric algorithm like RS256 and share only the public key.

#### A key id (kid) makes rotation safe
Keys must be rotated — on a schedule, or immediately if one leaks. Putting a key id (kid) in the token header lets a verifier hold several public keys at once and pick the right one per token. To rotate, you start signing with a new kid while verifiers still accept the old one, then retire the old key after the last token signed with it has expired. Without a kid, rotating a key invalidates every token in flight at once.

#### Signing with one key, verifying by key id during rotation
The issuer signs with the current private key; a verifier selects the matching public key by kid, and during rotation holds both the old and new keys.
* Issuer signs (RS256, kid=2026-06, private key)
* JWT header carries kid=2026-06
* Verifier looks up public key by kid:
  * kid=2026-06 (current)
  * kid=2026-03 (old, still accepted until its tokens expire)
* signature verified

### Example: generate an rs256 key pair and sign a token with a kid
```typescript
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";

// (1) RS256 key pair: sign with the private key, verify with the public key.
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

// (2) sign an access token: pin the algorithm, set kid, iss, aud, and a short expiry.
const accessToken = jwt.sign(
  { sub: "u_1", roles: ["filer"] },
  privateKey,
  { algorithm: "RS256", keyid: "2026-06", issuer: "filing-api", audience: "filing-clients", expiresIn: "15m" },
);
```
* **Annotation (1)** — only privateKey can sign; a verifier needs only publicKey, which is why a second service can verify without minting.
* **Annotation (2)** — keyid stamps the header so a verifier can select the key during rotation; issuer, audience, and a short expiresIn are the claims the verifier will check next topic.
* The payload (sub, roles) is readable by anyone — it is the signature, not secrecy, that protects it.

### AI Practice
#### Prompt it
Have Codex explain RS256 key rotation as concrete steps, then verify it against the closed-book requirement.
> Explain how to rotate an RS256 signing key for a JWT-issuing API without invalidating tokens that are already in flight. Give the exact sequence using a kid (key id) in the token header: what changes on the issuer, what changes on the verifier, and when the old key can finally be removed.

#### Watch out
Codex sometimes describes rotation as "replace the key," which would reject every unexpired token signed with the old one. It may also forget that verifiers must accept both keys during the overlap. Confirm the steps keep the old key accepted on the verifier until the last token signed with it has expired.

#### Verify
Confirm the sequence is: add the new key and start signing with the new kid; keep the old public key accepted on all verifiers; remove the old key only after the longest-lived token signed with it has expired. Then close the notes and explain the rotation aloud without AI — that is the closed-book check for this topic.

### Knowledge Check
1. Why does the team choose RS256 over HS256 for tokens the FastAPI service must verify?
   * **Answer**: RS256 lets a verifier hold only the public key, so it cannot mint tokens.
2. What does the signature on a JWT actually guarantee?
   * **Answer**: That the token came from a key holder and was not altered.
3. How does a kid (key id) in the token header make rotation safe?
   * **Answer**: It lets a verifier hold several keys and pick the right one per token.
4. During an RS256 key rotation, when can the old key finally be removed from the verifiers?
   * **Answer**: After the last token signed with the old key has expired.

---

## Topic 3 of 6: Verifying JWTs in Express with passport-jwt

### Why Do I Need to Know This?
The verifier is the single gate every protected route passes through, so its configuration is your security posture. If it fails to pin the algorithm or skips the issuer and audience checks, every route behind it is exposed at once. Getting this one piece of middleware right is what protects the whole API.

### Scenario
Your team wires a passport-jwt strategy that verifies the RS256 signature with the public key and pins the algorithm to RS256, then checks that the token’s issuer and audience match the API. They put it in front of the POST /filings route from the walking skeleton, so an unauthenticated or mismatched token is rejected with a 401 before the controller runs.

### Theory
#### passport-jwt extracts and verifies the token
passport-jwt is a Passport strategy that pulls the bearer token from the Authorization header and verifies it. You configure it with the verification key (secretOrKey — the RS256 public key here), the allowed algorithms, and the expected issuer and audience; on success it hands your callback the verified payload to map into a user object. It runs as middleware before the controller, consistent with the ordering from 2.3 The Express Skeleton: Validation, Errors & OpenAPI.

#### Pinning the algorithm is the core defense
The single most important option is algorithms: ["RS256"]. Without an allowlist, a verifier can be tricked into accepting a token whose header claims a different algorithm — including none, or a symmetric algorithm in a confusion attack (jsonwebtoken; fixed defaults landed in v9). Pinning the allowed algorithm means any token whose alg is outside the list is rejected before the signature is even checked. The attacks this blocks are the subject of the last topic.

#### Verify issuer and audience, not just the signature
A valid signature only proves the token came from a holder of the key. The issuer and audience checks prove it was minted by your issuer and intended for your API — so a correctly signed token meant for a different service is rejected. Skipping these is a common, silent gap: the token verifies, but it was never meant for you.

#### A request passing through the verifier
1. Request with Authorization: Bearer <token>
2. passport-jwt extracts the token
3. Check: Is alg in `[RS256]`?
   * No -> 401 Unauthorized
4. Check: Are signature, iss, aud, exp valid?
   * No -> 401 Unauthorized
5. Yes -> attach claims -> controller

### Example: a passport-jwt strategy guarding a route
```typescript
import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";

passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),  // (1) read the bearer token
    secretOrKey: publicKey,                                    // (2) RS256 public key
    algorithms: ["RS256"],                                     // (3) pin the algorithm — the core defense
    issuer: "filing-api",                                      // (4) must be our issuer
    audience: "filing-clients",                                // (5) must target our API
  },
  (payload, done) => done(null, { id: payload.sub, roles: payload.roles }),
));

// protect the walking-skeleton route
app.post("/filings", passport.authenticate("jwt", { session: false }), createFilingController);
```
* **Annotation (1)** — the token is read from `Authorization: Bearer <token>`; nothing downstream sees an unverified request.
* **Annotation (2) and (3)** — verification uses the public key and the pinned `["RS256"]` allowlist; a token claiming any other alg is rejected up front.
* **Annotation (4) and (5)** — issuer and audience ensure a validly signed token from elsewhere is still rejected if it was not minted by us, for us.
* `{ session: false }` keeps the request stateless — no server session is created, matching the token model.

### AI Practice
#### Prompt it
Ask Codex to scaffold the verifier middleware, then verify the security-critical options yourself.
> Configure a passport-jwt JwtStrategy in TypeScript that verifies RS256 tokens with a public key. Pin the algorithm to RS256, verify the issuer "filing-api" and audience "filing-clients", and map the payload to { id, roles }. Use it to protect a POST /filings route with sessions disabled. Show the route wiring.

#### Watch out
Codex frequently omits the algorithms allowlist (leaving the verifier open to alg=none/confusion attacks) or drops the issuer/audience checks because the token "still verifies" without them. It may also default to HS256 with a string secret. Confirm `algorithms: ["RS256"]`, the issuer and audience options, and the public key are all present.

#### Verify
Read the strategy options and confirm four things: the algorithm is pinned to `["RS256"]`, issuer and audience are set, and the key is the RS256 public key (not a shared string secret). Then send a request with no token and confirm a 401, and a request with a valid token and confirm it reaches the controller. Note any option Codex left out in your prompt journal.

### Knowledge Check
1. Which passport-jwt option is the core defense against algorithm-substitution attacks?
   * **Answer**: `algorithms`, which rejects any alg not on the allowlist.
2. A correctly signed token from a different service is accepted by your API. Which check was most likely missing?
   * **Answer**: The issuer/audience checks, which bind the token to your API.
3. Where does the passport-jwt verifier run relative to the route’s controller?
   * **Answer**: Before the controller, as middleware that rejects bad tokens with 401.
4. Why pass `{ session: false }` to `passport.authenticate` on the route?
   * **Answer**: It keeps the request stateless — no server-side session.

---

## Topic 4 of 6: Password hashing with argon2id

### Why Do I Need to Know This?
If your database leaks, the way you stored passwords decides whether attackers walk away with usable credentials or with hashes that cost more to crack than they are worth. Storing a slow, salted hash with the right algorithm is a deliberate, defensible choice a federal reviewer will check — and getting the parameters wrong quietly weakens it.

### Scenario
Your team adds a login that stores password hashes, never plaintext. They reject fast general-purpose hashes like SHA-256 and choose argon2id, tuned with explicit memory, time, and parallelism costs so a single verification is fast enough for a real login but a billion guesses are not.

### Theory
#### A password hash must be slow and salted
Passwords must never be stored in plaintext, and they must not be stored with a fast hash like MD5 or SHA-256. Fast hashes are designed to be cheap, which is exactly what an attacker wants when guessing billions of candidates. A password hash must be deliberately slow and salted, so that each guess costs real time and identical passwords do not collide to the same hash.

#### argon2id is the current recommended choice
argon2id is OWASP’s recommended password hashing algorithm. It is tuned by three parameters: memory cost, time cost (iterations), and parallelism. OWASP’s baseline is m = 19456 KiB (19 MiB), t = 2, p = 1 as a minimum, raised on stronger hardware. These are chosen on purpose, not left to a library default you never read, because the parameters are what set the attacker’s cost.

#### Verification is a one-call comparison
You never decrypt a hash — there is no "un-hash." To check a login, you hash the candidate password with the stored parameters and compare, which the library does in one verify call. A good library also tells you when a stored hash used weaker parameters than your current policy, so you can re-hash on the next successful login.

#### Storing and checking a password
* **Signup**: plaintext password -> `argon2id(salt, m=19456, t=2, p=1)` -> store the hash (never the password)
* **Login**: candidate password -> `argon2.verify(stored hash, candidate)` -> match -> allow / no match -> deny

### Example: hashing and verifying with argon2id
```typescript
import argon2 from "argon2";

// (1) hash at signup with explicit, tuned parameters (OWASP baseline).
const hash = await argon2.hash(plaintextPassword, {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
});

// (2) verify at login — no decryption, just a comparison.
const ok = await argon2.verify(hash, candidatePassword);
if (!ok) throw new UnauthorizedError();
```
* **Annotation (1)** — `type: argon2.argon2id` and the three explicit costs are the whole security decision; the library generates a per-password salt automatically and embeds it in the hash string.
* **Annotation (2)** — verify re-hashes the candidate with the parameters stored in the hash and compares; a failed match is a 401, not a 500.
* Storing the hash, never the password, is what limits the damage of a database leak.

### AI Practice
#### Prompt it
Have Codex propose argon2id parameters, then verify them against current OWASP guidance rather than trusting the defaults.
> Set up password hashing with the argon2 library in TypeScript using argon2id. Propose memory cost, time cost, and parallelism values and explain the trade-off between login latency and cracking resistance. Then write a hash-and-verify roundtrip. State which OWASP guidance your parameters come from.

#### Watch out
Codex may accept the library defaults without stating them, pick argon2i or argon2d instead of argon2id, or suggest a fast hash like bcrypt-with-low-cost or SHA-256. Confirm the type is argon2id, the three parameters are explicit, and they meet or exceed the OWASP baseline.

#### Verify
Check the parameters against the current OWASP Password Storage Cheat Sheet — at least m = 19456 KiB, t = 2, p = 1. Run the roundtrip: hash a password, verify the correct one returns true and a wrong one returns false. Time a single verify to confirm it is fast enough for login but not instant. Record the chosen parameters in your prompt journal.

### Knowledge Check
1. Why is SHA-256 the wrong choice for storing passwords?
   * **Answer**: It is fast, so an attacker can test enormous numbers of guesses cheaply.
2. What do the memory, time, and parallelism parameters of argon2id control?
   * **Answer**: The cost of each hash, which sets the attacker’s cost per guess.
3. How does login verification work when passwords are stored as argon2id hashes?
   * **Answer**: The candidate is hashed with the stored parameters and compared.
4. Codex suggests hashing passwords with bcrypt at a low cost factor "for speed." How should you respond?
   * **Answer**: Reject it; the program uses argon2id tuned to the OWASP baseline.

---

## Topic 5 of 6: Auth attacks and the regressions that prove the defense

### Why Do I Need to Know This?
Auth code is judged by the attacks it withstands, and the classic JWT failures are well known — which means they are exactly what a regression test must lock down so a future refactor cannot quietly reopen them. A passing attack test is the difference between "we think it’s secure" and "we prove a forged token is rejected."

### Scenario
Your team writes attack regressions against the verifier from earlier: a token forged with alg=none is rejected, a token signed with the wrong key is rejected, and tokens never appear in the logs. These become permanent tests, so the day someone "simplifies" the verifier and drops the algorithm allowlist, the suite turns red.

### Theory
#### alg=none and algorithm confusion
The alg=none attack sends a token with the header algorithm set to none and no signature, betting the verifier trusts the header. Algorithm confusion sends a token signed with a symmetric algorithm where the verifier expected an asymmetric one. Both succeed only against a verifier that trusts the token’s own alg; the pinned algorithms: ["RS256"] allowlist from the verifier topic rejects them before any signature work (jsonwebtoken).

#### Weak secrets and leaked tokens
A short or guessable HS256 secret can be brute-forced offline, which is one more reason the program prefers RS256; the AGENTS.md rule forbids any HS secret shorter than 32 bytes. Separately, tokens and secrets must never be written to logs — a token in a log file is a credential in a log file. Keeping them out is the job of the boundary redactor, previewed here and built in 3.3 Audit Logging & Redaction.

#### A regression test makes the defense permanent
Each attack becomes a test that fails against a naive verifier and passes against the hardened one. That is what makes it a regression: it does not just check the current code, it fails loudly if a future change reintroduces the hole. Writing the forged token in the test is safe and necessary — it proves the rejection, rather than assuming it.

#### A forged alg=none token meeting the pinned verifier
* Attacker forges token: header alg=none, no signature.
* Sent to verifier.
* Check: Is alg in `[RS256]`?
  * No -> 401 (rejected before signature work)
  * A naive verifier with no allowlist would trust the header alg and accept the forgery.

### Example: an alg=none regression test
```typescript
import jwt from "jsonwebtoken";
import request from "supertest";
import { expect, test } from "vitest";
import { app } from "../src/app";

test("rejects an alg=none forged token", async () => {
  // (1) forge a token with no signature, claiming admin
  const forged = jwt.sign({ sub: "attacker", roles: ["admin"] }, null, { algorithm: "none" });

  const res = await request(app)
    .post("/filings")
    .set("Authorization", `Bearer ${forged}`)   // (2) present it to the protected route
    .send({ taxpayer_id: 1, status: "draft", total_cents: 100 });

  expect(res.status).toBe(401);                  // (3) pinned algorithms:["RS256"] rejects it
});
```
* **Annotation (1)** — the forged token carries elevated claims but no real signature; a naive verifier that trusts the header alg would accept it.
* **Annotation (2)** — the test exercises the real route and middleware, not a mock, so it proves the deployed verifier rejects the forgery.
* **Annotation (3)** — the 401 confirms the allowlist works; if someone later drops algorithms: ["RS256"], this test fails and blocks the merge.

### AI Practice
#### Prompt it
Have Codex explain the alg=none attack and generate a regression test, then confirm the test actually proves the defense.
> Explain the JWT alg=none attack in two sentences. Then write a Vitest + supertest regression test that forges an alg=none token with elevated roles, sends it to a protected route, and asserts a 401. The test must hit the real app and verifier, not a mock.

#### Watch out
Codex may write a test that asserts the token is invalid by inspecting it directly, rather than sending it through the real route — which proves nothing about the deployed verifier. It may also "fix" the verifier and the test together in a way that always passes. Confirm the test sends the forged token to the actual protected route and would fail if the allowlist were removed.

#### Verify
Run the test against the hardened verifier and confirm it passes (401). Then temporarily remove `algorithms: ["RS256"]` from the strategy and rerun — the test must fail, proving it actually guards the defense. Restore the allowlist. Add the wrong-key and weak-secret cases, and record the three regressions in your prompt journal.

### Knowledge Check
1. What makes the alg=none attack succeed against a vulnerable verifier?
   * **Answer**: The verifier trusts the algorithm named in the token header.
2. Why write the forged token directly inside the regression test?
   * **Answer**: Because presenting the actual forgery proves the verifier rejects it.
3. A regression test for alg=none should behave how, across a hardened and a naive verifier?
   * **Answer**: Pass on the hardened verifier and fail on the naive one.
4. Why must tokens never be written to the application logs?
   * **Answer**: Because a logged token is a usable credential that can be replayed.

---

## Topic 6 of 6: Practice — add auth to a route and prove the attacks fail

### Why Do I Need to Know This?
This lesson’s payoff is a protected route that withstands the classic JWT attacks, and you only know it holds by attacking it yourself. This exercise has you drive Codex to build the login, the RS256 issuer, and the passport-jwt verifier, then verify — by forging tokens — that the defenses actually fire. It is the verify-don’t-trust loop applied to security code, where trusting the AI’s "looks secure" is exactly the failure mode.

### Theory
The loop is propose → attack-your-own-route → record: Codex proposes the login, the RS256 issuer, and the passport-jwt verifier, you attack the result — forging an alg=none token, signing with the wrong key, and sending a wrong-audience token — and you record anything that gets through. Security code is the worst place to trust a green happy-path test: a verifier missing its algorithm allowlist still authenticates a real user, so only the attack that should fail proves the defense. The forged request, not Codex’s "looks secure," is the judge.

### AI Practice
#### Prompt it
Hands-on practice for this lesson — build the auth flow with Codex locally, then attack your own route and confirm each defense holds.
> In my Express service, add: a login that hashes passwords with argon2id (OWASP baseline parameters), an RS256 token issuer with a kid in the header, and a passport-jwt verifier that pins algorithms to ["RS256"] and checks issuer and audience. Protect POST /filings with it. Then write Vitest + supertest regression tests for three attacks: an alg=none forgery, a token signed with the wrong key, and a token with the wrong audience. All three must return 401.

#### Watch out
Codex may leave the algorithms allowlist off, default to an HS256 string secret, log the token while debugging, or pick argon2i instead of argon2id. Any one of those passes a happy-path test while leaving a real hole. Read the verifier options and the hashing type before trusting the green checks.

#### Verify
Run the three attack tests and confirm each returns 401. Then prove they are real: remove the `algorithms: ["RS256"]` allowlist and confirm the alg=none test fails, then restore it. Grep your logs for the token string and confirm it never appears. Confirm the hashing type is argon2id with parameters at or above the OWASP baseline. Record what Codex got wrong, if anything, in your prompt journal for the ADR-0003 discussion.
