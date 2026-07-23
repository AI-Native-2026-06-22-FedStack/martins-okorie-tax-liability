Week 4 · Day 4
"Contract Testing with Pact"
Make the polyglot contract a test — consumer-driven vs producer-driven contracts, Pact consumer pacts and provider verification through a broker, a contract-drift regression that fails CI on a breaking bump, and a clear-eyed view of when Pact pays off and when it does not.

1
Topic 1 of 5
Consumer-driven vs producer-driven contracts
Why Do I Need to Know This?
You now have a versioned shared-schemas package between Express and FastAPI, but a schema that says "this is the shape" does not prove the provider actually returns it or that the consumer actually uses it. Contract testing closes that gap — and the first decision is who defines the contract. Consumer-driven contracts pin what the consumer really uses, so a provider change that would break the consumer is caught before it ships. That is the model the team adopts for two services it owns.

Scenario
Express is the consumer of the FastAPI allocation API; FastAPI is the provider. Your team wants the consumer’s real expectations to be the thing the provider is held to, so that if FastAPI renames a field Express reads, the build fails before anyone deploys. They choose consumer-driven contracts and record why: for two internal services they own, the consumer’s actual usage is exactly what must not break.

Theory
A consumer-driven contract captures what the consumer uses
A consumer-driven contract is defined by the consumer: it records the requests the consumer makes and the parts of the response it actually relies on. The provider must then satisfy exactly those expectations. The contract is not "everything the provider could return" — it is "what this consumer needs," which is precisely the surface that must not break.

Producer-driven contracts describe what the provider offers
A producer-driven contract is the reverse: the provider publishes what it offers, and consumers adapt to it. That fits a public API with many unknown consumers, where the provider cannot know who depends on what. It is heavier for an internal pair, because it does not focus on any one consumer’s real usage — it documents the whole surface whether or not anyone uses it.

For internal pairs, consumer-driven catches the breakage that matters
When your team owns both sides, the consumer-driven model catches the failure that actually hurts: a provider change that breaks a field the consumer reads. The consumer’s expectations become the test the provider must pass, so the break surfaces in CI on the provider side rather than in production on the consumer side. That is why the team picks it for the Express–FastAPI pair.

Consumer-driven vs producer-driven
Consumer-driven: the consumer’s expectations become the contract the provider must satisfy. Producer-driven: the provider publishes a contract consumers adapt to.

Producer-driven

Provider publishes contract

Consumers adapt

Consumer-driven

Consumer expectations

contract

Provider must satisfy

Example
the consumer's expectation is the contract
Express (consumer) relies on, from POST /allocations:
  - response has `allocations`: an array
  - each item has `state` (string) and `amountCents` (integer)
  - it does NOT read `computedAt` -> not part of THIS consumer's contract

=> The contract is exactly these fields. FastAPI (provider) may add other fields
   freely, but must keep `state` and `amountCents` on each allocation item.
Copy
The contract is scoped to what Express actually reads, not the provider’s full response.
A field Express ignores (computedAt) is not in the contract, so the provider can change it without breaking Express.
Renaming or removing state or amountCents is a break, because the consumer depends on them — that is what verification will catch.
AI Practice
Prompt it
Have Codex contrast the two contract styles for your services and recommend one, then check the rationale fits an internal pair.

My Express service consumes my FastAPI allocation API; I own both. Explain
consumer-driven vs producer-driven contract testing, and recommend which fits
this internal pair and why. Then list exactly which fields of the allocation
response belong in a consumer-driven contract if Express reads `state` and
`amountCents` but ignores `computedAt`.
Copy
Watch out
Codex sometimes recommends producer-driven for internal services "for completeness," which documents the whole surface instead of focusing on what the consumer needs. It may also include fields the consumer ignores in the contract, over-constraining the provider. Confirm the recommendation is consumer-driven for the owned pair, and that the contract contains only the fields the consumer actually reads.

Verify
Check that the recommendation is consumer-driven with a reason grounded in owning both sides, and that the listed contract fields are exactly the ones Express reads (state, amountCents) and exclude the ignored one (computedAt). Then close the laptop and explain consumer-driven contracts in your own words — the closed-book check asks for exactly this. Record the field list in your prompt journal.

Knowledge Check
1. What defines a consumer-driven contract?
The full set of fields the provider is capable of returning.
What the consumer actually uses from the provider.
The database schema the provider stores its data in.
Whatever fields appear in the provider’s OpenAPI document.
2. When does a producer-driven contract fit better?
For two internal services that one team owns on both sides.
When the provider wants to ignore what consumers actually use.
When the consumer and provider share a single codebase.
For a public API with many unknown consumers.
3. Why does the team choose consumer-driven for the Express–FastAPI pair?
It catches a breaking provider change before deploy.
It removes the need to version the shared-schemas package.
It lets the provider change any field without consequences.
It documents every field the provider could ever return.
4. A field the consumer ignores (computedAt) — is it part of the consumer-driven contract?
Yes, every field in the response is part of the contract.
Yes, because the provider returns it on every response.
No — the provider may change it freely.
Only if it is also listed in the shared-schemas package.
2
Topic 2 of 5
Pact mechanics — consumer pacts, the broker, provider verification
Why Do I Need to Know This?
A consumer-driven contract is only a safety net if it is executable on both sides. Pact makes it so: the consumer’s test generates a pact file describing the interactions it relies on, a broker shares that file, and the provider verifies against it. That turns "we agreed on a shape" into "the provider provably satisfies what the consumer needs" — the moving parts your team wires this lesson.

Scenario
Your team writes consumer pact tests on the Express side that record its expectations of the allocation API, publishes the resulting pact to a Pact Broker running in the local compose stack, and runs provider verification on the FastAPI side against that pact. When verification passes, both sides know FastAPI meets Express’s real expectations; when it fails, the break is visible before deploy.

Theory
The consumer test generates the pact
On the consumer side you write a test using Pact JS (PactV4): it spins up a mock provider, the consumer code runs against it, and the test records each interaction it relies on into a pact file. The pact is generated from the consumer’s own tests, so it reflects real usage — not a hand-written wish list. If Express stops reading a field, the pact stops requiring it.

The broker shares pacts between the two sides
The Pact Broker stores the pact files and the verification results and shares them between consumer and provider. The team runs a broker in the compose stack: the consumer publishes its pact there, and the provider fetches it from there to verify. The broker is also where the compatibility matrix lives (the next topic), recording which versions have verified against which.

Provider verification replays the consumer’s expectations
On the provider side, Pact’s Verifier (pact-python for FastAPI) fetches the pact and replays each recorded interaction against the real running provider, checking the responses match what the consumer expects. It publishes pass/fail back to the broker. Verification runs against the actual service, not a mock of it — that is what makes the result trustworthy.

Consumer test to provider verification, via the broker
The consumer test produces a pact, the broker shares it, and the provider verifies against the real service.

FastAPI (provider)
Pact Broker
Express (consumer test)
run consumer test against mock -> pact file
1
publish pact
2
fetch pact for this provider
3
replay interactions against the real service
4
publish verification result (pass/fail)
5
Example
a consumer pact and the provider verifier
// Express (consumer) — Pact JS (PactV4) records the expectation

//Pact needs a fixed name for each side of the pair: the Express service becomes `express-filing`, the FastAPI service becomes `fastapi-allocation`.

const pact = new PactV4({ consumer: "express-filing", provider: "fastapi-allocation" });

await pact
  .addInteraction()
  .uponReceiving("a request for an allocation")
  .withRequest("POST", "/allocations", (b) => b.jsonBody({ filingId: "f1" }))
  .willRespondWith(200, (b) =>
    b.jsonBody({ allocations: [{ state: "CA", amountCents: 1000 }] }))   // (1) the contract
  .executeTest(async (mock) => { await fetchAllocation(mock.url, "f1"); }); // (2) real consumer code

python
//# FastAPI (provider) — pact-python (v3) replays the pact against the real service
from pact import Verifier

(                                                        //(3 fetch from broker, replay vs real service, publish
    Verifier(name="fastapi-allocation")
    .add_transport(url="http://localhost:8000")          # the real running provider
    .broker_source(url=BROKER_URL)                        # fetch this provider's pacts from the broker
    .set_publish_options(version="1.3.0")                 # publish the verification result
    .verify()
)
Copy
Annotation (1) — the consumer test declares only the fields Express relies on; that becomes the pact, the executable contract.
Annotation (2) — executeTest runs the real consumer function against Pact’s mock, so the pact reflects actual usage.
Annotation (3) — the provider’s Verifier (the current pact-python builder API) adds the running service as a transport, fetches this provider’s pacts from the broker, replays them against the real service, and publishes the pass/fail result.
AI Practice
Prompt it
Have Codex wire the consumer pact and provider verification through the broker, then verify they run against the real service.

Set up Pact contract testing between my Express consumer (express-filing) and
FastAPI provider (fastapi-allocation). On the Express side, write a Pact JS
(PactV4) consumer test that records the allocation interaction and publishes the
pact to a Pact Broker running in my compose stack. On the FastAPI side, use
pact-python's Verifier to fetch the pact from the broker and verify it against the
running service, publishing the result. Show both sides.
Copy
Watch out
Codex may verify the provider against a mock or a stub instead of the real running service, which proves nothing. It may also skip the broker (verifying a local pact file only) so the two sides are not actually sharing the contract, or hard-code the expected response in the provider test. Confirm the consumer pact is generated from real consumer code, the provider verifies the running service, and the pact travels through the broker.

Verify
Run the consumer test and confirm it produces a pact file and publishes it to the broker. Run provider verification and confirm it fetches from the broker and replays against the actually-running FastAPI service (stop the service and confirm verification fails). Check the broker shows the published pact and the verification result. Record that verification ran against the real provider, not a mock, in your prompt journal.

Knowledge Check
1. Where does the consumer’s pact file come from?
It is hand-written to list every field the provider returns.
Generated from the consumer’s own tests.
Exported from the provider’s OpenAPI document automatically.
Produced by the broker from the verification results.
2. What is the Pact Broker’s role?
To store and share pacts and verification results.
To run the consumer’s tests and generate the pact for it.
To replace the provider during verification with a mock.
To rewrite the contract whenever the provider changes.
3. Why must provider verification run against the real running service?
Because the broker refuses pacts verified against a mock.
Because a mock cannot store the verification result.
Verifying a mock proves nothing about the real provider.
Because the consumer test already verified the mock provider.
4. What does the provider publish back to the broker after verifying?
A new copy of the pact regenerated from the provider’s responses.
The provider’s full OpenAPI document for the consumer to read.
A mock of the provider for the consumer’s next test run.
The pass/fail verification result for that pact version.
3
Topic 3 of 5
Contract-drift regression — a breaking bump must fail CI
Why Do I Need to Know This?
A contract is only a safety net if breaking it fails the build. Your team wires the Pact verification into CI so a backward-incompatible change to the allocation API cannot merge green — and then proves the gate is real by breaking the contract on purpose and watching CI go red. A gate you have never seen fail is a gate you cannot trust.

Scenario
Your team makes a deliberate breaking change: a required field that Express reads is renamed on the FastAPI side. Provider verification replays Express’s pact, finds the field missing, and fails — so the change cannot merge. A compatible change (adding an optional field Express ignores) verifies green. The contract gate has now been seen failing, so the team trusts it.

Theory
Verification in CI turns the contract into a gate
Running provider verification in CI ties the pact to the build: if the provider no longer satisfies the consumer’s pact, the job fails and the change does not merge. This moves the break from production on the consumer side to a red check on the provider side — the whole point of contract testing. The pact is the test; CI is where it gates.

Breaking changes fail; compatible changes pass
A change that violates the consumer’s expectations — a renamed or removed field the consumer reads, a newly required request field — must fail verification. A compatible change — an added optional field the consumer ignores — must pass. This mirrors the semver rule from 4.3 The Second Service: FastAPI & Bounded Contexts: a major bump is breaking, and contract verification is what proves the version was honest.

The compatibility matrix records what works with what
The broker maintains a compatibility matrix — which consumer and provider versions have verified successfully against each other. Pact’s can-i-deploy tool reads that matrix to answer "is this version safe to deploy against what is already running?" In this module you wire verification as a CI gate; the full can-i-deploy deployment check is a CD concern, out of scope here.

i
Note
This week you land working verification and a CI gate that fails on a breaking change. The hardened pipeline — can-i-deploy deployment gates and the full compatibility matrix in CD — is out of scope for this lesson. Here, the goal is: a breaking change turns the build red.

A schema change through the verification gate
A change is verified against the consumer’s pact; a breaking change fails CI, a compatible one passes.

breaks an expected field

compatible

provider change

verify against consumer pact

verification fails -> CI red, no merge

verification passes -> CI green

Example
a breaking change failing verification
Change: FastAPI renames response field `state` -> `stateCode`

Provider verification (replaying Express's pact):
  Verifying a pact between express-filing and fastapi-allocation
    a request for an allocation
      returns a response which
        has a matching body
          $.allocations[0].state -> expected 'CA' but field was missing   [FAILED]

Result: FAILED -> CI job exits non-zero -> change cannot merge
Copy
The pact expects state; the rename removes it, so verification fails on the missing field.
The failed job exits non-zero, turning the build red so the breaking change cannot merge.
Had FastAPI instead added an optional stateName field, the pact would still match and verification would pass.
AI Practice
Prompt it
Have Codex wire verification into CI, then prove the gate fails on a breaking change.

Wire my Pact provider verification (fastapi-allocation) into CI so the job fails
if the provider no longer satisfies the express-filing consumer pact. Then show
two changes and the expected CI outcome for each: (1) renaming the response field
`state` to `stateCode` (breaking), and (2) adding an optional `stateName` field
Express ignores (compatible). Make the breaking change fail the build.
Copy
Watch out
Codex may add the verification step but not fail the build on a verification failure (a job that reports red results but exits zero), so breaking changes still merge. It may also claim a renamed field is compatible, or skip proving the failure. Confirm the CI job exits non-zero on a failed verification, the rename is treated as breaking, and the optional-field addition passes.

Verify
Rename state to stateCode and confirm provider verification fails and the CI job exits non-zero — the change cannot merge. Revert and add an optional field Express ignores; confirm verification passes. If the job stays green on the rename, the gate is not wired to the exit code. Record that you watched the gate fail on a real breaking change in your prompt journal.

Knowledge Check
1. What does wiring Pact verification into CI accomplish?
A breaking provider change fails the build, not production.
It removes the need for the consumer to publish a pact.
It lets the provider deploy without the consumer’s pact.
It automatically rewrites the consumer to match provider changes.
2. Which change must fail provider verification?
Adding a new optional field the consumer does not read.
Improving the endpoint’s latency with no shape change.
Renaming a response field the consumer reads.
Adding a new endpoint the consumer never calls.
3. What is the compatibility matrix in the broker?
A list of every field each provider response contains.
A record of which versions have verified together.
The provider’s OpenAPI document indexed by version.
A queue of pending pacts that have not yet been verified.
4. Why deliberately break the contract and watch CI go red?
Because the broker requires a failing run before it accepts pacts.
Because a failed verification publishes the pact for the first time.
Because CI ignores verification results until one has failed once.
A gate that has never once failed cannot be trusted.
4
Topic 4 of 5
When Pact pays off, and when it doesn't
Why Do I Need to Know This?
Contract testing has a cost — pacts to write, a broker to run, verification to keep green — and applying it everywhere wastes effort and creates noise. Your team needs to know where Pact earns its keep so it uses the tool deliberately, the same "earn it" discipline the week applies to polyglot and to every new store.

Scenario
In a review a teammate wants Pact on every outbound HTTP call, including a one-off call to a stable third-party tax-rate API the team does not own. Your team scopes Pact to the contracts it owns and controls — its own consumer/provider pairs like Express–FastAPI — and uses other checks (a thin integration test, a recorded response) for the third-party call it cannot make verify on the provider side.

Theory
Pact pays off when you own both sides
Pact’s value comes from provider verification: the provider proves it meets the consumer’s pact. That requires you to control the provider so it can run verification in its CI. For two services your team owns — Express and FastAPI — that is exactly the case, and a consumer-driven contract prevents a real, likely break.

It pays off less for third parties and single-team-both-sides
For a third-party API you do not own, you cannot run provider verification — the provider will not verify your pact — so Pact gives you a one-sided mock at best; an integration test or a recorded contract serves better. And when a single team owns both sides in one repo with a shared test suite, a full broker-and-verification setup can be more ceremony than the risk warrants. The tool fits a specific shape: separately deployed services with a verifiable provider.

Choose deliberately — contract testing is a cost you take on where it earns its keep
Like polyglot persistence, contract testing is a cost you take on where it earns its keep. The decision is recorded in ADR-0010: which integrations are contract-tested, and why the others are not. Applying Pact by reflex to every call produces brittle pacts for things you cannot verify and noise that erodes trust in the gate.

Where Pact fits
Pact fits integrations where you own and can verify the provider; other integrations use other checks.

Use Pact — you own both sides and can verify the provider.
Example: Express (consumer) ↔ FastAPI (provider), both in your repos.
Don't use Pact — a third-party API you cannot make verify.
Example: an external tax-rate API. Use an integration test / recorded response instead.
Example
two integrations, one pact candidate
Integration A: Express -> FastAPI allocation API
  own the provider? YES  -> provider can run verification in CI
  => Pact: consumer-driven contract, verified in the provider's CI

Integration B: FastAPI -> external tax-rate API (third party)
  own the provider? NO   -> they will not verify our pact
  => NOT Pact: a thin integration test + a recorded/sample response
Copy
Integration A is a good Pact candidate: the team owns the provider, so verification is possible and meaningful.
Integration B cannot be provider-verified, so a Pact would be a one-sided mock; an integration test against the real (or recorded) API fits better.
The choice is written down — which integrations are contract-tested and why — so the decision is deliberate, not reflexive.
AI Practice
Prompt it
Have Codex classify your integrations as good or poor Pact candidates, then check the reasoning.

Classify each integration as a good or poor candidate for Pact contract testing
and explain why: (1) my Express service calling my FastAPI allocation service
(I own both), and (2) my FastAPI service calling an external third-party tax-rate
API (I do not own it). For the poor candidate, recommend an alternative check.
Copy
Watch out
Codex tends to recommend Pact for everything because it is "best practice," including third-party APIs you cannot verify — which yields a brittle, one-sided mock. It may also miss that single-team-both-sides cases can be over-engineered with a full broker. Confirm it marks the owned pair as a Pact candidate and the third-party API as not, with a sensible alternative for the latter.

Verify
Check that the owned Express–FastAPI pair is marked a good Pact candidate (you can verify the provider) and the third-party API is marked poor, with an integration test or recorded response recommended instead. Confirm the reasoning rests on whether you can run provider verification. Record which capstone integrations are contract-tested and why the others are not in ADR-0010.

Knowledge Check
1. When does Pact pay off the most?
For any HTTP call the system makes, owned or not.
When you own both sides and can verify the provider.
For third-party APIs, since they change without warning.
Only when the consumer and provider share one codebase.
2. Why is Pact a poor fit for a third-party API you do not own?
You cannot verify a provider you do not control.
Third-party APIs never return JSON that a pact can describe.
Pact is technically unable to send requests to external hosts.
A pact for a third party must be written in the provider’s language.
3. What should the team do for an integration that is a poor Pact candidate?
Write a Pact anyway so every integration is covered uniformly.
Skip testing that integration entirely to avoid the ceremony.
Use another check, like an integration test.
Make the third party adopt Pact before integrating with them.
4. Why record which integrations are contract-tested and which are not?
Because the broker rejects integrations missing from the record.
Because Pact bills per integration and the list controls cost.
So the decision is deliberate rather than applied by reflex.
Because untested integrations are removed from the system automatically.
