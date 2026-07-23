Week 4 · Day 3
"The Second Service: FastAPI & Bounded Contexts"
Grow the Module 3 FastAPI service into a real bounded-context owner — FastAPI path operations, dependencies, and BackgroundTasks; one service owning one part of the capstone; a versioned shared-schemas package with semver; and synchronous inter-service calls with httpx timeouts, retries, and jitter.

1
Topic 1 of 5
FastAPI fundamentals — path operations, dependencies, BackgroundTasks
Why Do I Need to Know This?
Your FastAPI service so far only verifies JWTs — it is a guard, not a service that owns work. To carry a real part of the capstone it needs actual endpoints, shared setup that every endpoint reuses, and a way to do follow-up work without making the caller wait. FastAPI gives you all three as first-class building blocks, and they reuse the dependency pattern you already met when you wired auth in 3.2 — Python Authentication & a Shared Trust Domain.

Scenario
Your team’s FastAPI service currently does one thing: check a token. The team gives it a real job — a state-allocation calculation for a filing — by adding a path operation for POST /allocations, a dependency that supplies the database session, and a BackgroundTask that records an audit entry after the response is sent so the caller is not blocked on it.

Theory
Path operations map routes to typed handlers
A path operation binds an HTTP method and path to a handler function — @app.post("/allocations") on an async def. FastAPI reads the handler’s typed signature (pydantic models, from 1.3 — Python Toolchain, Idioms & Async) to validate the request and generate the OpenAPI docs automatically, so the type annotations are the contract, not boilerplate you write twice.

Dependencies inject shared setup
A dependency is a function FastAPI resolves and injects via Depends(...), running before the handler. It is the same mechanism that injected the current user for auth in that lesson — now you use it for a database session, configuration, or any shared setup, so every endpoint reuses one verified, tested piece instead of re-creating it inline.

BackgroundTasks run work after the response
BackgroundTasks lets a handler schedule work that runs after the response is sent — background_tasks.add_task(fn, ...). It fits follow-ups that must not block the caller: writing an audit entry, sending a notification, warming a cache. It is in-process and best-effort, not a durable queue, so it suits "do this shortly after" work, not "this must not be lost" work (that is the eventing work in Module 6).

A request through dependencies, handler, and a background task
The dependency resolves first, the handler runs and returns, then the background task runs after the response is sent.

POST /allocations

Depends: db session

handler: compute allocation

response sent to caller

BackgroundTask: write audit entry (after response)

Example
a path operation with a dependency and a background task
from fastapi import FastAPI, Depends, BackgroundTasks
app = FastAPI()

def get_session():                          # (1) dependency: shared DB session
    with Session(engine) as s:
        yield s

@app.post("/allocations")                   # (2) path operation, typed body
async def create_allocation(
    body: AllocationRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session), # (3) injected before the handler runs
):
    result = compute_allocation(body, session)
    background_tasks.add_task(write_audit, "allocation.created", result.id)  # (4) after response
    return result
Copy
Annotation (1) — get_session is a dependency; FastAPI resolves it per request and yields a session the handler reuses.
Annotation (2) and (3) — the path operation declares a typed body and asks for the session with Depends; FastAPI runs the dependency first, then the handler.
Annotation (4) — add_task schedules the audit write to run after the response is sent, so the caller is not blocked on it.
AI Practice
Prompt it
Have Codex scaffold a FastAPI endpoint, then verify it reuses the 3.2 — Python Authentication & a Shared Trust Domain auth dependency instead of re-inventing it.

Add a POST /allocations endpoint to my FastAPI service. Use a typed pydantic
request body, inject a database session with a Depends dependency, and reuse my
existing get_current_user auth dependency so the route is protected. After
returning the response, write an audit entry with a BackgroundTask. Do not block
the response on the audit write, and do not re-implement token verification.
Copy
Watch out
Codex often re-implements token verification inline instead of reusing the 3.2 — Python Authentication & a Shared Trust Domain get_current_user dependency, duplicating the auth logic. It may also await the audit write in the handler (blocking the response) instead of using a BackgroundTask, or treat BackgroundTasks as a durable queue. Confirm it reuses the existing auth dependency, the audit write is a background task, and the route’s body is a typed pydantic model.

Verify
Call the endpoint with a valid token and confirm it returns the allocation and the audit entry appears shortly after (not before) the response. Call it without a token and confirm the reused auth dependency rejects it with 401. Confirm the handler does not await the audit write. Record whether Codex reused the auth dependency or duplicated it in your prompt journal.

Knowledge Check
1. What does FastAPI use the path operation’s typed signature for?
Only to render the function name in stack traces during errors.
To validate the request and generate the OpenAPI docs.
To decide which database table the handler will write to.
To set the number of worker processes uvicorn will start.
2. What is a FastAPI dependency (Depends) for?
Delaying the handler until an external service becomes available.
Caching the handler’s response so repeat calls skip it.
Injecting shared setup like a DB session or the current user.
Converting the response model into an OpenAPI schema definition.
3. When does a function scheduled with BackgroundTasks run?
After the response is sent to the caller.
Before the handler, as part of resolving its dependencies.
On a separate durable queue with delivery guarantees.
Only if the handler explicitly awaits the task to finish.
4. Why reuse the 3.2 — Python Authentication & a Shared Trust Domain get_current_user dependency on the new endpoint?
Because FastAPI forbids defining auth logic in more than one place.
Because a dependency runs faster than inline verification code.
Because inline verification cannot read the Authorization header.
So every route shares one tested, consistent auth check.
2
Topic 2 of 5
Bounded-context ownership — one service owns one part of the capstone
Why Do I Need to Know This?
A second service only earns its cost if it owns a coherent slice of the domain. Bolt a grab-bag of unrelated endpoints onto it and you have rebuilt the coupling the split was meant to remove — two services that must change together. Your team picks one bounded context for the Python service to own end to end, and holds the line that the other service reaches it only through its API.

Scenario
Your team decides the FastAPI service owns state allocation — splitting a filing’s amounts across states. It owns the allocation data and the calculation logic; the Express service never touches the allocation tables directly. When Express needs an allocation, it calls the FastAPI service’s API. That is the anti-shared-DB rule from 3.5 — REST Versioning, Service Boundaries, Sync Calls & Secrets, now drawn across the boundary between two languages.

Theory
A bounded context is a coherent slice with one owner
A bounded context is a portion of the domain with its own model and a single owning service — the same idea from 3.5 — REST Versioning, Service Boundaries, Sync Calls & Secrets, now realized as a separate service. State allocation is a good context because it is cohesive: its data and logic belong together and change for the same reasons, so one service can own all of it without reaching into another’s concerns.

The owner exposes an API, not its database
The owning service owns its tables and exposes them only through its API. The other service never opens a connection to those tables — it calls the API. This is the anti-shared-DB rule: share the database and a schema change in the allocation context breaks Express too, collapsing the boundary. Keep access behind the API and the owner can evolve its storage freely, exactly as in Module 3 but now across the polyglot line.

Polyglot only where it earns its keep
A second language and service is a cost — another runtime, another deploy, another contract to keep in sync. The Python service exists because its context genuinely benefits from being separate (its own scaling, its own ownership), not because polyglot is a goal. The rule for the week is to justify each new service or store with a constraint the alternative cannot meet, written in an ADR.

Two contexts, access only through the API
The filing context (Express) and the allocation context (FastAPI) each own their data; the only arrow between them goes through the API, never the database.

Allocation context -- FastAPI

Filing context -- Express

calls the API, not the DB

Express API

filing DB

FastAPI API

allocation DB

Example
crossing the boundary through the api, not the table
// in the Express (filing) service, needing an allocation

// WRONG — reaching into the allocation context's table directly
// const rows = await allocationDb.query("SELECT * FROM allocation WHERE filing_id = $1", [id]); // (1)

// RIGHT — call the allocation service's API
const res = await httpClient.post(`${ALLOC_API}/allocations`, { filingId: id }, { headers: auth }); // (2)
const allocation = res.data;                                                                        // (3)
Copy
Annotation (1) — a direct query binds Express to the allocation context’s schema, so a change there breaks Express — the boundary leaks.
Annotation (2) — calling the FastAPI service’s API goes through its stable contract instead of its private storage.
Annotation (3) — Express depends on the documented API shape, leaving the allocation service free to change its tables behind it.
AI Practice
Prompt it
Have Codex propose which context the Python service should own, then accept or reject each split with a reason.

Here is my capstone domain: taxpayer, filing, line_item, state_allocation,
payment. Propose which single bounded context the FastAPI service should own and
why, and which stay with the Express service. For every cross-context need, show
the access going through the owning service's API, not a shared database query.
Flag any proposal that would require Express to read another context's tables.
Copy
Watch out
Codex tends to over-split (a service per entity) or to quietly assume Express can query the allocation tables directly for "convenience," which breaks the boundary. It may also propose a context that is not cohesive (random endpoints grouped together). Confirm the chosen context is coherent, has one owner, and that every cross-context access is an API call — reject any direct cross-context query.

Verify
Check that the proposed context is cohesive (its data and logic belong together) and owned by one service, and that no cross-context access is a direct database query. Try to make Express read the allocation table directly and confirm the design rejects it in favor of the API. Capture the chosen context and the rejected splits in your prompt journal for the ADR and the "polyglot only where it earns its keep" briefing.

Knowledge Check
1. What makes state allocation a good bounded context for its own service?
Its data and logic are cohesive and change together.
It is the entity with the largest number of database columns.
It is the only part of the domain written before the others.
It needs the fewest endpoints, so the service stays small.
2. Under the anti-shared-DB rule, how does Express get an allocation owned by FastAPI?
By opening a read-only connection to the allocation database.
By querying a shared table both services connect to.
By calling the FastAPI service’s API.
By importing the allocation service’s data-access module.
3. Why is reaching into another context’s tables directly a problem?
It is slower than an API call because the database is remote.
It requires the other service to expose its connection string.
It prevents the owning service from reading its own tables.
A schema change in the owner then breaks the other service.
4. What justifies adding a second language and service?
That the team wants experience operating a polyglot system.
That every domain entity deserves its own dedicated service.
A constraint the single-language alternative cannot meet.
That microservices are the standard architecture for new systems.
3
Topic 3 of 5
Versioned contracts in a shared-schemas package
Why Do I Need to Know This?
The two services now exchange allocation data, and without one agreed, versioned definition of that data every change becomes a guessing game — Express assumes one shape, FastAPI sends another, and the break shows up at runtime. A shared-schemas package is the single source both services build against, versioned with semver so a change announces whether it is safe or breaking.

Scenario
Express (the consumer) and FastAPI (the producer) both need the shape of an allocation request and response. Instead of each keeping its own copy that drifts, your team publishes packages/shared-schemas — the schema plus a semantic version — consumed by both services. When the allocation response changes, the version bump tells every consumer whether the change is backward-compatible or a break they must handle.

Theory
One package is the contract
A shared-schemas package holds the cross-service data definition in one place — JSON Schema is the natural lingua franca because both the TypeScript and Python sides can consume it. Both services depend on the package, so the contract is the package, not an informal agreement or two copies that drift. A change happens in one place and propagates by version.

Both sides validate against the one schema
JSON Schema is language-neutral, which is exactly why it fits a polyglot boundary: each service validates payloads against the same file using its own native library — jsonschema on the Python (FastAPI) side, ajv on the Node (Express) side.

# FastAPI (Python) — validate against the shared schema
from jsonschema import validate
validate(instance=payload, schema=allocation_schema)   # raises on any mismatch
Copy
// Express (Node) — validate against the SAME shared schema
import Ajv from "ajv";
const ok = new Ajv().compile(allocationSchema)(payload);   // false on any mismatch
Copy
Because both sides check against one source of truth, they cannot silently drift — the classic failure where Python emits days as an integer while Node expects a string is caught at the boundary, not in production.

The two services depend on that file differently, and this is a common point of confusion: Express installs it as an npm workspace dependency (@capstone/shared-schemas), but Python has no notion of npm or package.json. The engine reads the same allocation.schema.json by path from the monorepo and honors the version string as the agreed contract version. Different plumbing, one source of truth.

Semver signals compatibility
The package is versioned with semver. A major bump means a backward-incompatible change — a renamed or removed field, a newly required field — that consumers must adapt to. A minor or patch bump is backward-compatible — an added optional field, a clarified description. The version number is the signal; a consumer reading it knows whether upgrading is safe or a migration.

A compatibility test enforces the rule
Semver is only trustworthy if a breaking change is actually released as a major bump. A compatibility test checks the contract against the previous version and fails if a backward-incompatible change ships without a major bump — so the version number cannot lie.

But a schema check only proves the shape is agreed and versioned — it does not prove the provider actually returns that shape at runtime, or that the consumer reads only what it declares. That behavioral proof is the seam 4.4 Contract Testing with Pact builds on next: the consumer’s real usage becomes an executable pact that the provider is verified against, so a break turns the build red before it ships — the contract enforced by tests, not by good intentions.

Agreeing on a version at runtime, not just at build
The semver in package.json is a build-time label: inside one monorepo commit both services share the one schema file, so they cannot disagree. But they deploy independently — an Express built against v1.6 can be live in production when a new engine ships schema v2.0. The version number alone enforces nothing at runtime; the deployed services still have to agree on which version they speak.

This is the same problem you solved for the external REST contract in 3.5 REST Versioning, Service Boundaries, Sync Calls & Secrets, and the same tools apply to this internal call: the consumer pins the version it speaks, the provider serves it, and the old version stays alive through the Deprecation/Sunset window while consumers migrate.

URL versioning — Express calls POST /v1/allocations; when the engine ships v2 it keeps /v1 responding alongside /v2 until Express moves over.
Header negotiation — one stable URL with the version in a header: Accept: application/vnd.allocation.v2+json (content negotiation) or a simpler X-API-Version: 2. The engine reads it and serves that version, or returns an explicit 406/409 for a version it can no longer satisfy — a loud mismatch, never a silently wrong shape.
i
Note
The version string enforces nothing on its own. A genuinely incompatible deploy — a v2.0 engine landing next to an Express still on v1.6 — is caught at deploy time, not by the number: Pact’s can-i-deploy checks the broker’s compatibility matrix and blocks the release if the two versions never verified together. That gate is 4.4 Contract Testing with Pact, deepened in other lessons.

One versioned contract, both services depend on it
The shared-schemas package is the single source; both services depend on a version, and a major bump flags a breaking change.

breaking -- consumers must adapt

packages/shared-schemas (JSON Schema, semver)

Express consumes v1.2

FastAPI consumes v1.2

remove a field -> v2.0 (major)

Example
a versioned shared schema consumed by both sides
// packages/shared-schemas/package.json
{ "name": "@capstone/shared-schemas", "version": "1.2.0" }

// packages/shared-schemas/allocation.schema.json — the contract
{
  "$id": "allocation",
  "type": "object",
  "required": ["filingId", "allocations"],          // (1) required fields are part of the contract
  "properties": {
    "filingId": { "type": "string" },
    "allocations": { "type": "array", "items": { "$ref": "#/$defs/stateShare" } }
  },
  "$defs": {
    "stateShare": {
      "type": "object",
      "required": ["stateCode", "days"],
      "properties": {
        "stateCode": { "type": "string" },
        "days":      { "type": "integer" },
        "apportionedIncome": { "type": "number" }
      }
    }
  }
}
Copy
Annotation (1) — the required list is contract-significant: adding a required field is a breaking change (a 2.0.0 major bump), because existing consumers do not send it.
Express installs @capstone/shared-schemas@1.2.0 as a workspace dependency; the Python engine reads the same schema file by path and honors that version string — the version is the shared agreement, and a major bump signals a break to both.
Adding an optional property is backward-compatible — a minor bump — because existing payloads still validate.
AI Practice
Prompt it
Have Codex set up the shared-schemas package and a drift test, then confirm the test fails on a major bump.

Create a packages/shared-schemas package holding a JSON Schema for the allocation
request/response, versioned with semver, consumed by both my Express and FastAPI
services. Add a contract-drift test that compares the current schema to the
previous version and fails if a backward-incompatible change (a removed field or
a newly required field) ships without a major version bump. Show it passing on an
added optional field and failing on a newly required field.
Copy
Watch out
Codex may copy the schema into each service instead of a shared package (so they drift), or treat any change as compatible — including a newly required field, which is breaking. It may also bump the version manually without a test that enforces it. Confirm there is one shared package, the drift test fails on a removed or newly-required field, and an added optional field is treated as a minor change.

Verify
Add an optional field and confirm the drift test passes (a minor change). Add a required field without a major bump and confirm the test fails. Confirm both services import the schema from the one package, not a local copy. Record which change types the test catches in your prompt journal — this is the contract 4.4 Contract Testing with Pact will verify end to end.

Knowledge Check
1. Why keep the cross-service contract in one shared package?
Because a package installs faster than copying a schema file.
Because only a package can hold a JSON Schema document.
So both services build against one source that cannot drift.
Because schemas in a package are validated automatically at runtime.
2. What does a major version bump signal?
A backward-incompatible change consumers must adapt to.
A purely cosmetic change such as a reworded description.
An added optional field that existing payloads still satisfy.
A performance improvement with no change to the schema shape.
3. Adding a newly required field to the contract is which kind of change?
Compatible — existing consumers simply ignore the new field.
Compatible, as long as the field has a default value defined.
Breaking — existing payloads omit it and now fail validation.
Neither — required fields are not part of the versioned contract.
4. Why add a compatibility test rather than trust the version number?
Because semver numbers are assigned automatically by the package registry.
Because the test replaces the need to version the package at all.
Because consumers cannot read a version number on their own.
So a breaking change cannot ship without a major bump.
4
Topic 4 of 5
Synchronous inter-service calls — httpx timeouts, retries, and jitter
Why Do I Need to Know This?
Express now calls the FastAPI allocation service for real work, synchronously, and a call with no timeout or retry policy turns a slow or flaky callee into a cascading failure — Express hangs, its callers hang, the whole slice stalls. You added a timeout in 3.5 — REST Versioning, Service Boundaries, Sync Calls & Secrets; now you harden the call so a transient blip recovers and a real failure surfaces fast and explicitly instead of hanging or being swallowed.

Scenario
Express calls the FastAPI allocation endpoint and waits for the result. Sometimes the callee is briefly slow under load. Building on the Module 3 timeout, your team adds bounded retries with exponential backoff and jitter using tenacity, so a transient failure is retried a few times with spread-out timing, and a persistent failure is raised as a clear upstream error after the attempts are exhausted — never an unbounded hang or a silent None.

Theory
A synchronous call needs a timeout and bounded retries
A synchronous cross-service call blocks the caller until it returns, so it must bound how long it waits (a timeout, from 3.5 — REST Versioning, Service Boundaries, Sync Calls & Secrets) and how many times it retries. Unbounded retries are worse than none — they pile load onto a callee that is already struggling. The policy is a small number of attempts with a timeout on each, then an explicit failure.

Backoff with jitter avoids the retry stampede
Retrying immediately, or all clients retrying on the same schedule, creates a retry stampede — a thundering herd that keeps the callee down. Exponential backoff spreads retries out over growing intervals; jitter adds randomness so many callers do not retry in lockstep. tenacity’s wait_exponential_jitter does both, which is why it is the policy rather than a fixed sleep.

Fail fast and explicitly, never silently
When retries are exhausted, the call must raise a clear upstream error the caller can turn into a proper response — not return None, not swallow the exception. A swallowed failure lets the caller proceed with missing data, which is worse than a visible error. The policy is uniform and declared (AGENTS.md: every cross-service call has a timeout + retry policy + jitter), not improvised per call site.

A call with timeout, bounded retries, and jitter
The call is attempted with a timeout; a transient failure is retried with backoff and jitter; exhausted retries raise an explicit error.

FastAPI / callee
Express / caller
wait (backoff + jitter), attempt 2
retries exhausted -> raise explicit upstream error
POST /allocations (timeout 5s)
1
timeout / 503
2
retry
3
timeout / 503
4
Example
httpx with a tenacity retry policy
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception

def is_transient(exc: BaseException) -> bool:            # (3) retry only transient failures
    if isinstance(exc, (httpx.TimeoutException, httpx.TransportError)):
        return True                                      # timeouts / connection errors
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500  # 5xx, not 4xx

@retry(                                                  # (1) bounded, jittered retry policy
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=1, max=10),
    retry=retry_if_exception(is_transient),
)
async def fetch_allocation(filing_id: str) -> dict:
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:  # (2) per-attempt timeout
        resp = await client.post(f"{ALLOC_API}/allocations", json={"filingId": filing_id})
        resp.raise_for_status()                          # raises HTTPStatusError on 4xx/5xx
        return resp.json()
# (4) after 3 failed attempts, tenacity re-raises — the caller handles an explicit error
Copy
Annotation (1) — tenacity’s @retry bounds attempts to 3 and waits with wait_exponential_jitter, so retries back off and are spread by jitter.
Annotation (2) — each attempt has a 5-second httpx.Timeout, so no single attempt can hang the caller.
Annotation (3) — is_transient retries only what a retry can fix: timeouts, transport errors, and 5xx. A 4xx like 401 or 404 is not retried — it can never succeed, so raise_for_status()’s HTTPStatusError surfaces it immediately instead of wasting three attempts.
Annotation (4) — once the attempts are exhausted, tenacity re-raises the last error; the caller surfaces it explicitly rather than returning None.
AI Practice
Prompt it
Have Codex add the timeout and retry policy, then verify retries are bounded, jittered, and a final failure is raised.

Harden my httpx call from Express's flow to the FastAPI allocation service. Add a
per-attempt timeout, and a bounded retry policy using tenacity with exponential
backoff and jitter (at most 3 attempts). Retry on transient HTTP errors and
timeouts. When all attempts fail, raise an explicit upstream error — do not
return None or swallow the exception. Show the retry decorator and the call.
Copy
Watch out
Codex frequently writes the call with no timeout (an unbounded hang), retries without a cap (amplifying load), uses a fixed delay instead of backoff with jitter, or catches the final error and returns None, hiding the failure. Confirm there is a per-attempt timeout, retries are capped, the wait uses exponential backoff with jitter, and a final failure is raised, not swallowed.

Verify
Point the call at a service that is down and confirm it makes the capped number of attempts, then raises an explicit error within a bounded time — not an unbounded hang or a None. Confirm the waits grow and vary (backoff + jitter), not a fixed sleep. Confirm a transient failure that recovers on the second attempt succeeds. Record the attempt count and failure behavior in your prompt journal.

Knowledge Check
1. Why must a synchronous cross-service call have both a timeout and a retry cap?
So the call can run on a background thread without blocking.
A hang blocks the caller; uncapped retries pile on load.
So the response can be cached and reused on the next call.
Because httpx refuses to send a request without a retry policy.
2. What problem does jitter on retries solve?
It makes each individual retry complete faster than the last.
It guarantees the callee will be available on the next attempt.
It stops many callers from retrying in lockstep.
It converts a failed request into a successful one automatically.
3. When all retry attempts are exhausted, what should the call do?
Return None so the caller can continue with default data.
Retry indefinitely until the callee eventually recovers.
Raise an explicit upstream error for the caller to handle.
Restart the FastAPI service to clear the failing condition.
4. What does tenacity’s wait_exponential_jitter provide?
Growing waits plus randomness between attempts.
A fixed delay applied identically before every retry.
An unlimited number of retries until the call succeeds.
A timeout applied to the whole sequence of attempts.
