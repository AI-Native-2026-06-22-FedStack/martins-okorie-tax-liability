# Week 3 · Day 5
# REST Versioning, Service Boundaries, Sync Calls & Secrets

Make the contract durable and the service operable: version the REST contract with a deprecation and sunset policy, draw bounded-context ownership and the anti-shared-DB rule, keep inter-service calls synchronous on purpose, and move secrets to a managed store with rotation and least privilege.

## Topics

### 1. Versioning the REST contract and signaling deprecation
- **Versioning choice**: Pick one versioning approach and record the trade-off in ADR-0005. URL versioning (`/v1`, `/v2`) is explicit, easy to route, and cache-friendly, but creates more URLs. Accept-header versioning keeps URLs stable, but is harder to test and easier for caches to miss.
- **Breaking changes**: Renaming a response field, removing a field consumers depend on, or removing a route requires a new version. Adding a new optional field or adding a new endpoint can usually ship in place.
- **Deprecation policy**: Define how long deprecated versions remain live, how the end date is announced, and how consumers are pointed to the replacement.
- **Standard headers**: Use `Deprecation` (RFC 9745, published March 2025) to mark a resource deprecated and `Sunset` (RFC 8594) to announce when it stops responding. The sunset date must not be earlier than the deprecation date.
- **Migration hint**: Use `Link: </v2/...>; rel="successor-version"` to point clients to the replacement route.

Example:

```ts
app.post("/v1/filings", (req, res, next) => {
  res.set("Deprecation", "@1735689600");
  res.set("Sunset", "Wed, 31 Dec 2026 23:59:59 GMT");
  res.set("Link", '</v2/filings>; rel="successor-version"');
  next();
});
```

Verification:
- Confirm ADR-0005 states the chosen versioning style and the reason for the choice.
- Confirm the policy names a concrete deprecated-version lifetime.
- Confirm deprecated routes emit `Deprecation`, `Sunset`, and successor `Link`.
- Test three scenarios: renamed field is breaking, removed route is breaking, added optional field is non-breaking.

### 2. Microservice boundaries: bounded contexts and anti-shared-DB
- **Bounded context**: A coherent domain slice with its own model, vocabulary, and owner. Avoid one-service-per-table over-splitting.
- **Ownership rule**: Each service owns its tables. Other services access that data only through the owning service's API.
- **Anti-shared-DB rule**: A service must not directly query another service's tables, even read-only. Direct joins across contexts are boundary violations.
- **Why it matters**: If another service reads the owner's schema directly, the owner can no longer rename columns, split tables, or optimize storage without breaking consumers.
- **TaxPulse framing**: Preserve clear ownership around Tax Plan Cycle workflow data, auth/identity data, audit data, and compute-service behavior. Public API contracts are stable; private schemas are not shared.

Example:

```py
# WRONG: identity service couples to filing schema
# row = filing_db.execute("SELECT name FROM taxpayer WHERE id = %s", [tid])

# RIGHT: identity service calls the filing API contract
resp = httpx.get(f"{FILING_API}/taxpayers/{tid}", headers=auth)
name = resp.json()["name"]
```

Verification:
- Draw the bounded-context map and name the owning service for each domain object.
- Walk every cross-context relationship and confirm it is an API call, not a DB query.
- Record rejected splits and shared-DB proposals in the prompt journal.

### 3. Synchronous vs asynchronous inter-service calls
- **Synchronous calls**: Request-and-wait. Simple and immediate, but couple availability: if the callee is slow or down, the caller is slow or fails.
- **Asynchronous messaging**: Fire-and-forget. Loosens availability coupling, but adds delivery guarantees, ordering, retries, and eventual consistency. Eventing is deferred to Module 6 for this sprint.
- **Sprint decision**: Keep inter-service calls synchronous when the caller genuinely needs the answer to proceed, and make that choice explicit.
- **Required safeguards**: Every synchronous call needs a timeout, bounded retries with backoff when appropriate, and an explicit upstream error after final failure. Never swallow the error or return `None`/empty data.

Example:

```py
import httpx

def get_taxpayer_name(tid: str, auth: dict) -> str:
    try:
        resp = httpx.get(
            f"{FILING_API}/taxpayers/{tid}",
            headers=auth,
            timeout=httpx.Timeout(5.0, connect=2.0),
        )
        resp.raise_for_status()
        return resp.json()["name"]
    except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError):
        raise UpstreamUnavailable("filing service unavailable")
```

Verification:
- Point the caller at a downed callee and confirm it fails within the timeout.
- Confirm retries are capped and use backoff.
- Confirm final failure surfaces as an explicit upstream error.
- Confirm no path returns `None`, empty data, or a silent fallback on failure.

### 4. Secrets at runtime: managed store, rotation, and least privilege
- **Managed store**: Production secrets belong in a managed store such as AWS Secrets Manager, not committed `.env` files or fixtures.
- **Local development**: Use LocalStack as the local Secrets Manager endpoint so the same code path runs locally and in AWS by changing configuration.
- **Fail fast**: Missing or malformed secrets must fail at startup with a clear error, not during the first request.
- **Caching and rotation**: Cache loaded secrets and refresh on an interval or miss so rotation is picked up without redeploying.
- **Least privilege**: Each service identity can read only the secrets it actually needs. A compute service should not be able to read an API signing key unless it truly needs it.
- **Strict config**: Validate non-secret configuration at boot with a strict Zod schema, using `z.url()` and `z.coerce.number()` where appropriate.

Example:

```ts
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { z } from "zod";

const sm = new SecretsManagerClient({ endpoint: process.env.AWS_ENDPOINT_URL });
const cache = new Map<string, { value: string; fetchedAt: number }>();
const REFRESH_MS = 5 * 60_000;

async function loadSecret(id: string): Promise<string> {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.fetchedAt < REFRESH_MS) return cached.value;

  const out = await sm.send(new GetSecretValueCommand({ SecretId: id }));
  if (!out.SecretString) throw new Error(`secret ${id} missing`);

  cache.set(id, { value: out.SecretString, fetchedAt: Date.now() });
  return out.SecretString;
}

const Env = z.object({
  AWS_ENDPOINT_URL: z.url(),
  PORT: z.coerce.number()
});

const env = Env.parse(process.env);
```

Verification:
- Start with a required secret missing from LocalStack and confirm boot fails clearly.
- Rotate a secret in LocalStack and confirm refresh picks it up without redeploy.
- Grep the repo and config for committed secret values.
- Record the secrets strategy and fail-fast behavior in ADR-0007 and the prompt journal.

### 5. Practice: durable contract and managed secrets
- Add URL versioning with a deprecated `/v1` route that emits `Deprecation`, `Sunset`, and successor `Link`.
- Enforce anti-shared-DB access by routing cross-context reads through APIs.
- Keep Node-to-Python calls synchronous for this sprint, with timeout, bounded retry, and explicit upstream failure.
- Load database password and signing key from AWS Secrets Manager through LocalStack, cache and refresh them, fail fast on missing secrets, and validate remaining environment configuration with strict Zod.
- Add tests for the deprecation headers, boundary access pattern, downed callee behavior, missing secret boot failure, rotation refresh, and no committed secrets.

## Common Codex Watch-Outs

- It may cite only RFC 8594 and miss that `Deprecation` is RFC 9745.
- It may treat optional field additions as breaking changes.
- It may over-split contexts into one service per table.
- It may quietly introduce a shared-DB join across contexts.
- It may write synchronous calls with no timeout.
- It may catch upstream failures and return `None`, empty objects, or silent fallbacks.
- It may add unbounded retries that amplify load.
- It may read secrets from `.env` "for local dev," which is the anti-pattern for this lesson.
- It may load secrets once and never refresh, so rotation is never observed.

## Deliverable Hints

- ADR-0005: REST versioning and deprecation/sunset policy.
- Bounded-context map: service ownership and rejected shared-DB paths.
- Sync-call implementation: timeout, bounded retry, explicit upstream error.
- ADR-0007: secrets strategy, managed store, LocalStack, caching, rotation, least privilege.
- Tests: deprecated-route headers, cross-context API access, downed-callee failure, missing-secret startup failure, rotation pickup, and no committed secrets.
