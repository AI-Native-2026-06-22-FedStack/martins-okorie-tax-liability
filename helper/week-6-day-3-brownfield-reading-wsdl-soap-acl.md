🕐 Last Updated: 2026-07-13 19:52:25 UTC
📌 Commit: 230c4d0e
Week 6 · Day 3
Brownfield #1: Reading a WSDL & Building a SOAP ACL
Integrate the first legacy system in a day — face brownfield reality, read a WSDL with AI-assisted code archaeology and verify it operation by operation, then ship a SOAP anti-corruption-layer microservice (node-soap + circuit breaker + audit log + Pact) that lets no legacy type leak past the boundary.

1
Topic 1 of 5
Brownfield reality and AI-assisted code archaeology
Why Do I Need to Know This?
Until now the capstone has been greenfield: the team wrote every line, and every call was a request to a service it built. Real federal work is the opposite — most of it is integrating with systems no one on the team wrote, whose documentation is stale and whose original authors have moved on. The skill that turns a multi-week reverse-engineering slog into a one-day integration is code archaeology: using Codex to summarize an undocumented artifact quickly, then verifying every claim it makes against the source. Without that skill the team either guesses and ships bugs, or stalls waiting for an expert who is not coming.

Scenario
The team is handed a legacy SOAP service that verifies taxpayer identity — a TaxpayerVerification service with a WSDL file, no documentation, and no available expert — and one day to integrate it into the filing flow. Opening the WSDL by hand and reading raw XML would burn the morning. Instead the team attaches a read-only SOAP/WSDL MCP server and asks Codex to summarize the service: what operations it exposes, what each takes and returns, and what errors it declares. Every line of that summary is treated as a claim to be checked, not a fact to be trusted.

Theory
Brownfield is the normal case, not the exception
A brownfield system is one that already exists and that you do not get to rewrite. In federal environments most integration targets are brownfield: a SOAP service from a decade ago, a database whose logic lives in stored procedures, a nightly file feed. The job is almost never "replace it" — a rewrite needs budget, authority, and a working spec the team does not have. The job is to integrate with it safely, behind a boundary, while leaving it untouched. Treating integration as the goal (not rewrite) is what makes a one-day deadline realistic.

AI-assisted archaeology: summarize fast, then verify
Code archaeology is reading an undocumented artifact to recover what it does. Codex accelerates the reading: pointed at the WSDL through the read-only MCP server, it produces a structured summary — the operations, their inputs and outputs, the declared faults — in seconds rather than the hour it takes to parse the XML by hand. The acceleration is real, but the summary is a hypothesis, not an authority. Codex can misread a type, miss a fault, or confidently describe an operation that the WSDL does not actually declare. The summary’s value is that it tells you where to look, not that it tells you the truth.

The verification ritual is the safeguard
The discipline that makes archaeology safe is the same one this whole module runs on: read what Codex explains, confirm it against the source, and never accept a summary without checking. For a WSDL that means walking the summary operation by operation against the actual <operation>, <message>, and <fault> declarations in the file. The ritual is not optional caution — it is the thing that lets the team move fast. Codex finds the structure in seconds; the engineer confirms it in minutes; together that is a morning, not a week.

!
Important
A Codex summary is a starting point, not a sign-off. The integration is only as trustworthy as your verification of the summary. An unverified summary that happens to be right looks identical to one that is wrong — the only way to tell them apart is to check against the WSDL.

Summarize-then-verify archaeology loop
Codex reads the WSDL through the MCP server and produces a summary; the engineer verifies it against the source before any of it is trusted.

matches

discrepancy

Legacy WSDL (no docs)

Read-only SOAP/WSDL MCP server

Codex summary: operations, types, faults

Engineer verifies against the WSDL

Confirmed understanding

Correct the summary, re-check

Example
an archaeology prompt and the summary to verify
Prompt to Codex (via the SOAP/WSDL MCP server):
  "Summarize the TaxpayerVerification WSDL: list every operation with its
   input and output message types and any declared faults. Do not infer
   behavior the WSDL does not state."

Codex summary (a hypothesis to check, not a fact):
  - VerifyTaxpayer(VerifyTaxpayerRequest) -> VerifyTaxpayerResponse
      fault: TaxpayerNotFoundFault
  - GetTaxpayerStatus(GetStatusRequest)   -> GetStatusResponse
      fault: (none declared)            <-- verify: is this really undeclared?
Copy
The summary names two operations; the engineer’s next step is to open the WSDL and confirm each <operation> exists with those exact message types.
The TaxpayerNotFoundFault is a claim about the error contract — the engineer checks the <fault> element to confirm it is declared, because the anti-corruption layer must map it.
The (none declared) note on GetTaxpayerStatus is the highest-risk line: an operation that looks fault-free but actually declares a fault leads to unhandled failures, so this is verified first, not last.
AI Practice
Prompt it
Have Codex summarize the legacy WSDL through the MCP server, then verify the summary operation by operation.

Using the read-only SOAP/WSDL MCP server, summarize the TaxpayerVerification
service: list each operation with its input/output message types and every
declared fault. Do not infer any behavior the WSDL does not explicitly declare.
Present it as a table I can check line by line against the WSDL source.
Copy
Watch out
Codex tends to describe a SOAP service the way it assumes such services usually work, inventing plausible operations or omitting a declared fault because it "looks" like a simple read. It may also normalize type names to friendlier forms that do not match the WSDL. Confirm every operation, message type, and fault in the summary against the actual <operation>, <message>, and <fault> elements, and treat any "no fault declared" claim as the first thing to check, not the last.

Verify
Open the WSDL and confirm each operation Codex listed is present with the exact input and output message types named. For every operation, confirm whether a <fault> is declared and whether the summary got it right. Record each discrepancy — an invented operation, a wrong type, a missed fault — in your prompt journal, because those are the points where an unverified summary would have shipped a bug.

Knowledge Check
1. Your team is given an undocumented legacy SOAP service to integrate in one day, with no available expert. What is the realistic goal?
Rewrite the service in the capstone’s stack so the team fully owns it.
Integrate with it behind a boundary, leaving it unchanged.
Wait for the original authors to document it before writing any code.
Copy its logic into the capstone and delete the legacy service afterward.
2. Codex returns a summary of the WSDL’s operations in seconds. How should the team treat that summary?
As authoritative documentation, since it was generated directly from the source file.
As a reason to skip reading the WSDL, since the summary already covers it.
As proof the integration is straightforward, because the summary is short.
As a hypothesis to verify against the WSDL before trusting it.
3. Why does the summarize-then-verify ritual let the team move faster, not slower?
Codex finds the structure fast; the engineer just confirms it.
Verifying the summary is optional, so the team can skip it under deadline.
The ritual replaces reading the WSDL entirely with reading Codex output.
It lets the team integrate without ever opening the legacy artifact.
4. Codex’s summary marks one operation as having "no fault declared." Why verify that line first?
Because operations without faults cannot be wrapped by an anti-corruption layer.
Because a missing fault means the operation is deprecated and should be skipped.
Because if a fault really exists, that error path goes unhandled.
Because faults are the only part of a WSDL that Codex is able to read.
2
Topic 2 of 5
Reading a WSDL — types, operations, faults, and bindings
Why Do I Need to Know This?
The WSDL is the contract of the legacy SOAP service — the only authoritative statement of what it accepts, returns, and can fail with. To verify Codex’s summary and to wrap the service safely, the engineer has to read the WSDL’s four moving parts well enough to know what each call needs and what can go wrong. The fault declarations matter most: they are the error contract the anti-corruption layer must map, and a fault the team misses becomes an unhandled failure in production.

Scenario
Codex’s summary lists two operations on the TaxpayerVerification service, but before the team writes a single call it confirms the details against the WSDL. It checks the message types each operation takes and returns, reads the TaxpayerNotFoundFault declaration to learn the shape of the error it must handle, and confirms the binding is document/literal SOAP over HTTP so the node-soap client will speak the right wire format. Only after the contract is confirmed operation by operation does the boundary design begin.

Theory
A WSDL has four parts the integrator must read
A WSDL 1.1 document describes a SOAP service in four parts, and each tells the integrator something different:

Types — the data shapes, declared as XML Schema, that messages are built from.
Operations — the callable methods, grouped under a portType; each operation names the messages it sends and receives.
Faults — the declared error cases on an operation, each carrying its own message shape; this is the error contract.
Bindings — how operations map to the wire: the protocol (SOAP over HTTP) and the encoding style (document/literal or rpc/encoded). For this lesson it is enough to confirm which style the WSDL declares, not to master the difference.
Reading all four is what lets you call the service correctly and handle its failures; reading only the operations leaves you blind to the errors.

Faults are the error contract, and they are first-class
A SOAP fault is a structured error the service is declared to return — not an exception you discover at runtime, but part of the published contract. In the WSDL, an operation lists its faults alongside its input and output, and each fault references a message with its own type. TaxpayerNotFoundFault is not a generic 500; it is a specific, typed outcome the service promises to return when a taxpayer id does not exist. The anti-corruption layer must map every declared fault to a clean error the capstone understands. A fault that is in the WSDL but missing from your handling is an error path that crashes or silently passes the wrong result.

Verify operation by operation against the source
The unit of verification is the operation, because that is the unit you will call and wrap. For each one, confirm three things against the WSDL: its input message type, its output message type, and every fault it declares. This is the concrete form of the module’s ritual — Codex’s summary is checked one operation at a time until the team can say, from the source, exactly what each call needs and what it can return. Skipping an operation because it "looks simple" is how a missed fault reaches production.

!
Warning
A missed fault is an unhandled failure. If the WSDL declares a fault your code does not map, that error path is undefined behavior in your integration — it may throw an unmapped exception, or worse, be swallowed and return a wrong answer. Confirm every declared fault before wrapping the operation.

The anatomy of a WSDL
A WSDL splits into abstract definitions (types, operations, faults) and a concrete binding to the wire; the integrator reads each part for a different reason.

Types
XML Schema data shapes.
Read to build valid requests.
Operations (portType)
Callable methods + their messages.
Read to know what you can call.
Faults
Declared, typed error cases.
Read to map the error contract.
Bindings
Protocol + encoding (SOAP/HTTP, doc/literal).
Read to speak the right wire format.
Example
an annotated wsdl excerpt
<!-- one operation, with its input, output, AND a declared fault -->
<message name="VerifyTaxpayerRequest">
  <part name="parameters" element="tns:VerifyTaxpayer"></part>      <!-- (1) input type -->
</message>
<message name="VerifyTaxpayerResponse">
  <part name="parameters" element="tns:VerifyTaxpayerResult"></part> <!-- (2) output type -->
</message>
<message name="TaxpayerNotFoundFault">
  <part name="fault" element="tns:TaxpayerNotFound"></part>          <!-- (3) typed fault -->
</message>

<portType name="TaxpayerVerificationPort">
  <operation name="VerifyTaxpayer">
    <input  message="tns:VerifyTaxpayerRequest"/>
    <output message="tns:VerifyTaxpayerResponse"></output>
    <fault name="notFound" message="tns:TaxpayerNotFoundFault"></fault> <!-- (4) part of the contract -->
  </operation>
</portType>
Copy
Annotation (1) and (2) — the request and response <message> elements name the XML Schema types from the types section; these are the shapes the node-soap client will send and receive.
Annotation (3) — the fault has its own message and type, TaxpayerNotFound; it is as structured as the success response, not a generic error string.
Annotation (4) — the <fault> inside the <operation> is what makes TaxpayerNotFoundFault part of the published contract; the anti-corruption layer must map this to a clean capstone error.
AI Practice
Prompt it
Have Codex extract each operation’s full contract from the WSDL, then verify the faults against the source.

From the TaxpayerVerification WSDL, produce a table with one row per operation:
operation name, input message type, output message type, and every declared
fault with its message type. Flag any operation that declares no fault. Quote the
exact <operation> and <fault> XML for each row so I can confirm it against source.
Copy
Watch out
Codex often lists inputs and outputs accurately but drops the faults, or reports a fault by a friendly name that does not match the WSDL’s message type. It may also assume rpc/encoded when the binding is document/literal (or vice versa), which changes how requests are built. Confirm each fault against the <fault> element and its message, and check the <binding> style before trusting any generated client code.

Verify
For each operation, confirm the input and output message types in Codex’s table match the <message> elements in the WSDL. Confirm every <fault> declared on an operation appears in the table with the correct message type, and that no fault was invented. Confirm the binding style (document/literal vs rpc/encoded) matches the <binding> section. Record any dropped fault or wrong binding assumption in your prompt journal.

Knowledge Check
1. You need to know what errors the legacy service can return so your integration handles them. Which part of the WSDL tells you?
The types section, because it declares every XML Schema shape the service uses.
The bindings section, because it specifies the protocol and encoding style.
The fault declarations on each operation.
The service section, because it lists the endpoint ports the service exposes.
2. Why is a declared SOAP fault different from an exception you discover at runtime?
It is part of the published contract, with its own typed message.
It is automatically retried by the SOAP runtime until the call succeeds.
It can only occur during the binding step, never during a normal call.
It is logged by the service, so the caller never needs to handle it.
3. Codex’s summary lists an operation’s input and output but no fault, while the WSDL declares one. What is the consequence if you trust the summary?
The node-soap client refuses to generate a method for an operation with an unmapped fault.
The binding style silently switches to rpc/encoded to compensate for the missing fault.
The service rejects the call because the fault was not acknowledged in advance.
That error path is unhandled — it may throw unmapped or return a wrong result.
4. Before generating a node-soap client, why confirm the WSDL’s binding style?
Because the binding style determines which faults the operation is allowed to declare.
Because document/literal and rpc/encoded build the request differently.
Because only rpc/encoded bindings can be consumed by a Node.js SOAP client.
Because the binding style sets the retention period for the service’s responses.
3
Topic 3 of 5
The anti-corruption layer — no legacy types past the boundary
Why Do I Need to Know This?
The danger in any integration is not the first call — it is what the legacy model does to the capstone over time. If SOAP-shaped objects flow straight into capstone handlers, the legacy system’s data model quietly becomes the capstone’s model, and replacing or retiring that legacy service later means touching every place its types spread to. An anti-corruption layer (ACL) prevents that: it translates at the boundary so the capstone keeps its own clean types and the legacy dependency stays replaceable.

Scenario
Codex’s first draft of the integration returns the raw VerifyTaxpayerResult SOAP object straight into a capstone filing handler. It works in a demo, but now a SOAP-generated type is referenced inside the capstone’s domain code. The team rejects that draft and inserts an anti-corruption layer: a translation function that converts every VerifyTaxpayerResult into a capstone TaxpayerVerification DTO at the boundary, and a test that fails the build if any SOAP-shaped type appears in a capstone-facing signature. The legacy shapes now stop at the door.

Theory
An ACL is a translation boundary
An anti-corruption layer is a Domain-Driven Design pattern: a layer of translation between two models so that one system’s concepts do not corrupt the other’s. For this integration it is concrete — legacy SOAP types go in, clean capstone DTOs come out. The capstone’s filing code depends only on the DTOs; it never sees VerifyTaxpayerResult or any other SOAP-generated shape. The ACL is the single place that knows the legacy model exists.

The hard rule: no legacy types past the boundary
The program rule (AGENTS.md) for every brownfield integration is that no legacy type crosses the ACL. Codex must convert at the boundary, and a type-leak test enforces it so the rule cannot erode under deadline pressure. The reason the rule is strict is that leaks are gradual: one SOAP type in one handler looks harmless, but it makes the next one easier to justify, and soon the legacy model is everywhere. A standing test that fails the build the moment a SOAP type appears in a capstone-facing signature is what keeps the boundary real over months.

The ACL is what makes the legacy dependency replaceable
The payoff of the boundary is optionality. Because callers depend on the capstone DTOs and not the SOAP shapes, the legacy TaxpayerVerification service can be swapped for a modern REST API, a different vendor, or an in-house rewrite by changing only the ACL’s translation — no capstone code changes. Without the ACL, the legacy types are load-bearing throughout the capstone, and replacing the service becomes a project instead of an afternoon. The boundary is an insurance policy against a dependency you do not control.

i
Note
The DTO is defined by the capstone, not derived from SOAP. A clean DTO names the fields the capstone actually needs in the capstone’s own vocabulary. If you generate the DTO by renaming SOAP fields one-for-one, you have copied the legacy model with new labels — the leak is still there, just disguised.

Legacy types stop at the ACL
The SOAP service’s types reach the ACL and no further; the capstone domain sees only clean DTOs.

SOAP types blocked here

Legacy SOAP service (VerifyTaxpayerResult)

ACL: translate to DTO

Capstone DTO (TaxpayerVerification)

Capstone domain code

Example
a boundary translator and the test that guards it
// the ACL boundary: SOAP type IN, capstone DTO OUT
export function toTaxpayerVerification(
  soap: VerifyTaxpayerResult,                       // (1) legacy type, only seen here
): TaxpayerVerification {                            // (2) clean capstone DTO
  return {
    taxpayerId: soap.TaxpayerID,
    verified: soap.Status === "VERIFIED",            // (3) translate the legacy enum to a boolean
    verifiedAt: new Date(soap.Timestamp),
  };
}

// the type-leak test: fails the build if a SOAP type escapes the boundary
test("capstone handler exposes no SOAP types", () => {
  // verifyTaxpayer's return type must be the DTO, not VerifyTaxpayerResult
  type Returned = ReturnType<typeof verifyTaxpayer>;
  expectTypeOf<Returned>().toEqualTypeOf<TaxpayerVerification>(); // (4) compile-time guard
});
Copy
Annotation (1) — VerifyTaxpayerResult is a SOAP-generated type; it appears only as the input to the translator, never in a capstone signature.
Annotation (2) — the function returns TaxpayerVerification, a DTO the capstone defined in its own vocabulary.
Annotation (3) — translation is real work: the legacy Status string becomes a verified boolean, so the capstone never reasons about the legacy enum.
Annotation (4) — the type-leak test asserts the capstone handler’s return type is the DTO; if a refactor lets a SOAP type through, the assertion fails to compile and the build breaks.
AI Practice
Prompt it
Have Codex design the ACL boundary, then verify no SOAP type appears in any capstone-facing signature.

Design an anti-corruption layer for the TaxpayerVerification SOAP service. Define a
capstone DTO named in our own vocabulary (not a renamed SOAP shape), write a
translator from the SOAP response type to that DTO, and add a type-level test that
fails if any capstone-facing function returns or accepts a SOAP-generated type.
Show the DTO, the translator, and the test.
Copy
Watch out
Codex frequently returns the SOAP response straight to the caller, or defines a DTO that is the SOAP shape with renamed fields — a disguised leak that still couples the capstone to the legacy model. It may also place the translator but never call it, so the boundary exists on paper while real code bypasses it. Confirm the DTO is defined in capstone terms, every capstone-facing signature uses the DTO, and the translator is actually on the path the handler calls.

Verify
Search the capstone-facing code for any SOAP-generated type name; there should be none outside the ACL module. Confirm the type-leak test fails when you deliberately change a handler to return the SOAP type, and passes once it returns the DTO. Confirm the DTO fields are named in the capstone’s vocabulary, not the legacy field names. Record any disguised leak — a DTO that is a renamed SOAP shape — in your prompt journal.

Knowledge Check
1. Codex returns the raw VerifyTaxpayerResult SOAP object into a capstone handler, and it works in the demo. Why reject this?
A SOAP type now lives in the capstone, coupling it to the legacy model.
SOAP objects cannot be serialized to JSON, so the handler will fail in production.
The demo passed only by luck and the call will fail on the next request.
Returning SOAP objects is slower than returning a plain capstone DTO.
2. What is the purpose of the type-leak test in the ACL?
It checks that the SOAP service is reachable before the capstone calls it.
It verifies the translator converts every field of the SOAP response.
It breaks the build if a SOAP type reaches a capstone signature.
It confirms the DTO and the SOAP type have the same number of fields.
3. A teammate defines the capstone DTO by renaming each SOAP field one-for-one. Why is the boundary still leaking?
Because renamed fields break the node-soap client’s ability to parse responses.
Because the DTO is the legacy model with new labels, so the coupling remains.
Because the type-leak test only passes when field names are identical.
Because renaming fields changes the SOAP wire format the service expects.
4. Six months on, the legacy SOAP service is replaced with a REST API. What did a properly built ACL buy you?
The capstone automatically discovers the new REST endpoint with no code changes anywhere.
The SOAP types are reused unchanged against the new REST API.
The capstone’s tests no longer need to run because the boundary is stable.
Only the ACL’s translation changes; capstone code stays the same.
4
Topic 4 of 5
Building the ACL microservice — node-soap, circuit breaker, audit, Pact
Why Do I Need to Know This?
The anti-corruption layer is not just a translation function — it is a microservice the capstone depends on for taxpayer verification, talking to a legacy SOAP service that may be slow or down. So it needs four things beyond translation: a SOAP client to make the calls, a circuit breaker so a flaky legacy service does not drag the capstone down, an audit log of every call for federal traceability, and the Pact contract testing from 4.4 Contract Testing with Pact so the capstone and the ACL cannot silently break each other. Building all four is what turns the boundary into a dependency the team can trust under load and prove under audit.

Scenario
With the WSDL understood and the boundary designed, the team builds the ACL as an Express microservice. It uses node-soap to call VerifyTaxpayer, wraps that call in an Opossum circuit breaker that opens after a run of failures so the capstone fails fast instead of stacking timeouts, writes an audit line for every call, and exposes a clean REST endpoint returning the capstone DTO. A Pact contract from the filing service pins the capstone↔ACL interaction, so a breaking change to the ACL’s response fails provider verification before it ships. Two capstone use cases — verifying a taxpayer at filing time and re-checking status — consume it.

Theory
The ACL is an Express microservice with a SOAP client
The ACL runs as its own Express service so the capstone talks to clean REST endpoints and never to SOAP directly. Inside, it uses node-soap as the SOAP client: createClientAsync(wsdlUrl) builds a client from the WSDL, and each operation becomes an async method (client.VerifyTaxpayerAsync(args)). The service’s job is narrow — call the SOAP operation, translate the result to a DTO at the boundary, and return it over REST. Everything the capstone sees is the DTO; everything the SOAP service sees is a node-soap call.

Resilience and auditability: circuit breaker plus audit log
A legacy dependency you do not control will eventually be slow or down, and a naïve client will pile up timeouts until the capstone itself stalls. An Opossum circuit breaker prevents that: you wrap the SOAP call in new CircuitBreaker(fn, options), and after failures cross errorThresholdPercentage (with at least volumeThreshold calls), the breaker opens and fails fast for resetTimeout milliseconds before testing the service again. The capstone gets a fast, clean error instead of a hung request. Alongside resilience, every call is audit-logged — operation, correlation id, outcome, duration — because a federal integration must be able to show who called the legacy system, when, and what happened.

i
Note
Open fast, recover gradually. When the breaker is open it rejects calls immediately, sparing the legacy service and the capstone. After resetTimeout it goes half-open and lets one trial call through; success closes it, failure re-opens it. Tune errorThresholdPercentage and volumeThreshold so a couple of transient errors do not trip it, but a real outage does.

Contract safety: Pact pins the capstone↔ACL interaction
The capstone and the ACL are two services with a contract between them, and that contract can break silently as either side changes. Pact — the consumer-driven contract testing from 4.4 Contract Testing with Pact — is the guard: the filing service (the consumer) declares the request it sends and the response it expects, and the ACL (the provider) is verified against that expectation in CI. If a change to the ACL alters the DTO the capstone relies on, provider verification fails before the change ships, so the two services cannot drift apart unnoticed.

The ACL microservice and its guards
The capstone calls the ACL over REST; the ACL calls the legacy SOAP service through a circuit breaker and audit log, and Pact verifies the capstone↔ACL edge.

REST + DTO

verifies

Capstone (filing service)

ACL microservice (Express)

Opossum circuit breaker

node-soap client

Legacy SOAP service

Audit log (every call)

Pact contract

Example
an opossum-wrapped node-soap call with an audit line
import CircuitBreaker from "opossum";
import * as soap from "soap";

const client = await soap.createClientAsync(WSDL_URL);            // (1) build SOAP client from the WSDL

const breaker = new CircuitBreaker(                               // (2) wrap the flaky dependency
  (req: VerifyTaxpayerRequest) => client.VerifyTaxpayerAsync(req),
  { timeout: 3000, errorThresholdPercentage: 50,                 // open at 50% failures...
    volumeThreshold: 5, resetTimeout: 10000 },                   // ...over >=5 calls; retry after 10s
);

export async function verifyTaxpayer(req: VerifyTaxpayerRequest): Promise<TaxpayerVerification> {
  const started = Date.now();
  try {
    const [soapResult] = await breaker.fire(req);                // (3) call through the breaker
    audit.log({ op: "VerifyTaxpayer", correlationId: req.correlationId,
                outcome: "ok", ms: Date.now() - started });      // (4) audit every call
    return toTaxpayerVerification(soapResult);                   // (5) translate at the boundary
  } catch (err) {
    audit.log({ op: "VerifyTaxpayer", correlationId: req.correlationId,
                outcome: "error", ms: Date.now() - started });
    throw err;
  }
}
Copy
Annotation (1) — createClientAsync reads the WSDL and returns a client whose methods mirror the operations; VerifyTaxpayer becomes VerifyTaxpayerAsync.
Annotation (2) — the breaker wraps the SOAP call; volumeThreshold: 5 means it will not trip on the first failure or two, and errorThresholdPercentage: 50 opens it once half of a real volume of calls fail.
Annotation (3) — breaker.fire(req) runs the call when closed and rejects immediately when open, so the capstone fails fast during an outage instead of hanging.
Annotation (4) — every call writes an audit line with the correlation id, outcome, and duration — the federal traceability requirement.
Annotation (5) — the SOAP result is converted to the capstone DTO at the boundary; no SOAP type is returned from this function.
AI Practice
Prompt it
Have Codex build the ACL microservice, then verify the breaker opens under failure and Pact provider verification passes.

Build an Express ACL microservice for the TaxpayerVerification SOAP service:
use node-soap (createClientAsync) for the SOAP call, wrap it in an Opossum circuit
breaker (timeout 3s, errorThresholdPercentage 50, volumeThreshold 5, resetTimeout
10s), audit-log every call with correlationId/outcome/duration, and expose a REST
endpoint returning our TaxpayerVerification DTO. Add a Pact provider verification
test for the filing-service consumer contract. Show the service, the breaker, and
the Pact test.
Copy
Watch out
Codex often calls node-soap directly without the circuit breaker, so a legacy outage hangs the capstone, or sets volumeThreshold to 1 so the breaker trips on a single transient error. It may log only failures instead of every call, breaking the audit trail, or return the SOAP result instead of the DTO. It sometimes writes a Pact consumer test in the ACL when the ACL is the provider. Confirm the SOAP call goes through the breaker, every call is audited, the endpoint returns the DTO, and the ACL is verified as the provider against the filing service’s contract.

Verify
Force the legacy service to fail repeatedly and confirm the breaker opens after the volume and error thresholds are crossed, returning a fast error rather than hanging. Confirm an audit line is written for both successful and failed calls. Confirm the REST endpoint returns the DTO, not a SOAP type. Run Pact provider verification against the filing-service contract and confirm it is green, then change the DTO shape and confirm verification fails. Record any direct-call-without-breaker or provider/consumer mix-up in your prompt journal.

Knowledge Check
1. The legacy SOAP service starts timing out under load. Without a circuit breaker, what happens to the capstone?
The capstone automatically routes verification calls to a backup SOAP service.
Calls pile up waiting on timeouts until the capstone itself stalls.
The SOAP service returns a declared fault that the capstone handles cleanly.
node-soap retries each call indefinitely until the service recovers on its own.
2. A teammate sets the Opossum breaker’s volumeThreshold to 1. What is the likely problem?
The breaker will never open because one call is too few to measure a failure rate.
The audit log stops recording successful calls once the breaker is configured.
A single transient error trips the breaker and blocks healthy traffic.
The breaker stays permanently open and never tests the service again.
3. Why is the ACL verified as the Pact provider rather than the consumer?
The capstone consumes the ACL, so the ACL must satisfy the capstone’s contract.
The ACL consumes the SOAP service, which makes it the consumer in every contract.
Pact only supports provider verification for services that translate types.
Provider verification is faster than consumer testing for SOAP integrations.
4. Why must the ACL audit-log every call, not only the failures?
Because Opossum requires a log entry per call to calculate its error threshold.
Because logging only failures would cause the circuit breaker to open prematurely.
Because successful calls are the only ones that carry a correlation id to record.
Because the audit trail must cover every call, not just the failed ones.
5
Topic 5 of 5
Practice — ship the SOAP ACL and integrate it into the capstone
Why Do I Need to Know This?
This lesson’s payoff is a working, trustworthy boundary around a legacy system you did not write and cannot change: the WSDL read and verified, the legacy types stopped at the door, and an ACL microservice the capstone depends on through a circuit breaker, an audit log, and a Pact contract. This SOAP integration is the one brownfield system that carries through to the capstone — at the Sprint 4 gate it is glued into the filing flow alongside the event bus. The way to know you have it is to build the ACL end to end with Codex and then attack it: feed it an undeclared fault, knock the legacy service over and watch the breaker open, try to leak a SOAP type and watch the build break, and change the DTO and watch Pact fail.

AI Practice
Prompt it
Hands-on practice for this lesson — build the SOAP ACL end to end with Codex, then break each guard.

Integrate the TaxpayerVerification SOAP service into our capstone behind an
anti-corruption layer, against the provided mock SOAP service and SOAP/WSDL MCP
server: (1) summarize the WSDL via the MCP server and verify each operation, type,
and fault against source; (2) define a capstone TaxpayerVerification DTO and a
boundary translator with a type-leak test; (3) build an Express ACL microservice
using node-soap, an Opossum circuit breaker (timeout 3s, errorThresholdPercentage
50, volumeThreshold 5, resetTimeout 10s), and an audit line per call; (4) add Pact
provider verification against the filing-service consumer contract; (5) wire two
capstone use cases to call the ACL. Show the verified WSDL summary, the DTO +
translator + leak test, the microservice, and the Pact test.
Copy
Watch out
Codex is likely to trust its own WSDL summary without checking faults, return SOAP types into the capstone or define a DTO that is a renamed SOAP shape, call node-soap without the circuit breaker, set volumeThreshold to 1, log only failures, and write a Pact consumer test in the ACL instead of provider verification. Each looks fine in a quick demo while leaving a real gap — an unmapped fault, a leaked type, a hang under outage, or undetected contract drift. Read the verified fault list, every capstone-facing signature, where the breaker wraps the call, what is logged, and which Pact role the ACL plays before trusting it.

Verify
Confirm every operation and declared fault in the WSDL is mapped, including any the summary first reported as fault-free. Change a handler to return the SOAP type and confirm the type-leak test breaks the build, then revert. Make the legacy service fail repeatedly and confirm the breaker opens and the capstone fails fast; confirm an audit line exists for both successful and failed calls. Run Pact provider verification green, then alter the DTO and confirm it fails. Confirm the two capstone use cases receive the DTO, never a SOAP type. Record every guard that failed on the first pass in your prompt journal.

