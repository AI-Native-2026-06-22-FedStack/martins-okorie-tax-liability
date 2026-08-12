🕐 Last Updated: 2026-07-21 20:38:20 UTC
📌 Commit: 97e02c10
Week 7 · Day 4
Lambda & API Gateway
Move one well-chosen capstone workload to serverless — a Node 24 Lambda handler behind an API Gateway HTTP API, packaged on ARM64 with shared layers and Powertools structured logging — then measure its cold start and write the ECS-vs-Lambda decision criteria in ADR-0021.

1
Topic 1 of 5
The Lambda execution model — handler, cold starts, concurrency, timeouts
Why Do I Need to Know This?
In 7.3 ECS Fargate & ALB you ran the always-on services as long-lived Fargate tasks. Some capstone work is not always-on — a nightly cron job, a low-traffic webhook — and paying for an idle task to sit waiting for it is wasteful. Lambda is a different compute model that scales to zero and bills per invocation, but it pays a cold-start cost and caps how long a single invocation can run. You need that model before you can decide which workload actually fits it, which is the decision this lesson ends on.

Scenario
The team has a webhook that fires a few times an hour and a nightly job that runs for two minutes. Running each as an always-on Fargate task means paying 24/7 for compute that is idle almost all the time. Lambda scales to zero between calls — but the team needs to understand cold starts and the timeout cap before moving anything.

Theory
The handler model: one invocation per event
A Lambda function is a handler that AWS invokes once per event. There is no long-running process between invocations; anything you want to reuse — a database client, a parsed config — must be created in the initialization code outside the handler, which runs once when the environment is created, not on every call. State inside the handler does not survive to the next invocation.

Cold starts: the first call pays initialization
When no warm execution environment is available — the first call, or during scale-out — Lambda must create one: load the runtime and run your init code before the handler executes. That is a cold start (AWS docs). Warm invocations reuse an existing environment and skip it. Cold starts affect only a small fraction of invocations in steady traffic, but they matter for latency-sensitive paths and are the main reason Lambda is a poor fit for strict, predictable latency.

Concurrency and the timeout cap
Lambda scales by running more environments concurrently — the account default is 1,000 concurrent executions, raisable on request, with reserved concurrency to guarantee capacity for one function. Each invocation has a hard timeout: the default is 3 seconds and the maximum is 900 seconds (15 minutes). Work that can run longer than 15 minutes does not fit a single Lambda invocation — a key input to the decision in the The decision — when Lambda beats Fargate (and when it doesn’t) topic.

i
Note
Because init code runs outside the handler and is reused by warm invocations, put expensive one-time setup (clients, connection pools, config parsing) there. Re-creating it inside the handler pays the cost on every call and wastes the warm-environment advantage.

Cold path versus warm path
A cold start initializes a new environment before running the handler; a warm invocation reuses an existing environment and skips initialization.

no -- cold start

yes -- warm

Event arrives

Warm environment available?

Create environment: load runtime, run init code

Run handler

Example
init outside the handler, work inside
import { Client } from "pg";

const db = new Client({ connectionString: process.env.DATABASE_URL });  // (1) init: runs once per environment
await db.connect();

export const handler = async (event) => {       // (2) runs once per event
  const { taxpayerId } = JSON.parse(event.body); // (3) no state carried from a prior invocation
  const result = await db.query("SELECT status FROM filings WHERE taxpayer_id = $1", [taxpayerId]);
  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
};
Copy
Annotation (1) — the database client is created in init code, outside the handler, so a warm invocation reuses the open connection instead of reconnecting.
Annotation (2) — the handler runs per event; everything it needs from a prior call must come from a store, not from in-memory state.
Annotation (3) — the handler reads its input from the event each time; nothing persists between invocations beyond what a warm environment happens to keep.
AI Practice
Prompt it
Have Codex write a Lambda handler with correct init placement, then verify nothing relies on per-invocation state.

Write a Node 24 Lambda handler for a webhook that looks up a filing by taxpayer id
in Postgres. Create the database client in initialization code outside the handler
so warm invocations reuse it, and read all input from the event inside the handler.
Do not assume any state persists between invocations. Show the init code and the
handler separately.
Copy
Watch out
Codex often creates the database client inside the handler (reconnecting on every call), or assumes a variable set on one invocation survives to the next. Confirm the client is initialized outside the handler, the handler reads everything from the event, and no cross-invocation state is assumed.

Verify
Invoke the function twice and confirm the second (warm) call reuses the initialized client rather than reconnecting — for example, log a line in the init code and confirm it appears only once across both invocations. Confirm the handler reads its input from the event and keeps no state between calls. Record any in-handler init or assumed persistence in your prompt journal.

Knowledge Check
1. What is a "cold start" in Lambda?
The first request after a deploy always fails and must be retried by the client.
A new environment initializes before the handler can run.
The function runs permanently slower after its very first invocation.
The handler is recompiled from source on every single invocation.
2. A workload sometimes needs to run for 25 minutes. What does that imply for Lambda?
Lambda will run it but bill only for the first 15 minutes used.
Lambda automatically splits the work across two sequential invocations.
Lambda raises the timeout to 25 minutes if you request it via support.
It exceeds Lambda’s 15-minute max, so Lambda is a poor fit.
3. Where should one-time initialization, like a database client, go in a Lambda?
Outside the handler, so a warm invocation can reuse it.
Inside the handler, so it is freshly created on every single call.
In a separate Lambda that the handler calls first on each request.
In the API Gateway integration, before the event reaches the Lambda.
4. Why does Lambda suit a low-traffic webhook better than an always-on service?
Because Lambda guarantees lower latency than any always-on service does.
Because a webhook cannot be served by a long-running container at all.
It scales to zero and bills per use, so idle costs nothing.
Because Lambda functions never experience any cold-start delay.
2
Topic 2 of 5
API Gateway — HTTP API versus REST API, and integration patterns
Why Do I Need to Know This?
A Lambda that serves an HTTP request needs a front door. API Gateway is it — but it comes in two products with different cost and features, and two integration styles that change how much work the gateway does versus the handler. Choosing the cheaper, simpler option when it suffices, and the richer one only when you need it, is a real cost and complexity decision for the capstone.

Scenario
The team exposes the webhook Lambda over HTTPS. They must choose between an HTTP API and a REST API, and decide whether the gateway passes the raw request straight through to Lambda or transforms it first.

Theory
HTTP API versus REST API
API Gateway offers two products. The HTTP API is lower-cost (roughly $1.00 per million requests versus $3.50 for REST) and lower-latency, with a deliberately minimal feature set — Lambda and HTTP proxy integrations, JWT authorization, CORS, and route-level throttling. The REST API adds richer features: response caching, AWS WAF integration, usage plans and API keys, request validation, per-method throttling, and request/response transformation. The rule of thumb is to default to HTTP API and reach for REST API only when you need a feature that is REST-only.

Proxy integration: the gateway forwards the raw request
With a proxy integration, API Gateway forwards the entire request — method, path, headers, query string, body — to the Lambda as a single event, and the handler parses what it needs. This is the simplest setup: the gateway does almost nothing, and all request handling lives in your code. It is the common default for serverless HTTP APIs.

Request-transform integration: the gateway shapes the input first
With a request-transform integration (a REST-API capability), the gateway maps and validates the request before invoking Lambda — pulling fields into a defined shape, rejecting malformed input at the edge. This moves work out of the handler and into the gateway, at the cost of more gateway configuration. The choice decides where request parsing and validation live: in the handler (proxy) or in the gateway (transform).

i
Note
API Gateway v2 (HTTP API) is emulated only on LocalStack’s Base tier or higher, not the free plan — so the deploy exercises in this lesson require the cohort’s licensed paid LocalStack plan. If the deploy fails to create the API on a free token, the emulator tier is the blocker, not your configuration.

One route, two integration styles
A proxy integration forwards the raw request to the handler; a request-transform integration shapes and validates it in the gateway first.

proxy: raw request

request-transform: shaped input

Client

API Gateway

Lambda parses it

Lambda gets validated fields

Example
an http api route with a lambda proxy integration
// HTTP API route → Lambda proxy integration:
//   POST /filings  →  filing-webhook Lambda  (proxy)

export const handler = async (event) => {       // (1) proxy event: whole request in one object
  const body = JSON.parse(event.body ?? "{}");  // (2) handler parses the raw body itself
  const taxpayerId = body.taxpayerId;
  if (!taxpayerId) {
    return { statusCode: 400, body: "taxpayerId required" };  // (3) validation in the handler
  }
  // ... process the webhook ...
  return { statusCode: 202, body: JSON.stringify({ accepted: true }) };
};
Copy
Annotation (1) — with a proxy integration the handler receives the entire request as the event; the gateway does not pre-parse it.
Annotation (2) — the handler parses the body itself, because the gateway forwarded it raw.
Annotation (3) — request validation lives in the handler. With a REST-API request-transform integration, that validation could instead happen in the gateway before the handler runs.
AI Practice
Prompt it
Have Codex set up the HTTP API and proxy integration, then verify the route invokes the handler with the proxy event.

Set up an API Gateway HTTP API with a POST /filings route that proxies to our
filing-webhook Lambda. Use a Lambda proxy integration so the handler receives the
full request. Write the route and integration config and a handler that parses the
proxy event body and validates taxpayerId. Explain why we chose HTTP API over REST
API here. We deploy to LocalStack first.
Copy
Watch out
Codex sometimes defaults to a REST API when an HTTP API would do (more cost and config for no benefit), or configures a non-proxy integration while writing a handler that expects the raw proxy event — a shape mismatch that fails at runtime. It may also invent REST-only features on an HTTP API. Confirm the API type matches the need, the integration type matches the handler’s event shape, and no REST-only feature is assumed on an HTTP API.

Verify
Deploy the HTTP API and route to LocalStack and confirm a POST to /filings invokes the Lambda and returns its response. Confirm the handler receives the full proxy event (method, headers, body) and parses it. Confirm the choice of HTTP API is justified by the route’s needs, not habit. Record any REST-vs-HTTP mismatch or integration-shape error in your prompt journal.

Knowledge Check
1. When should you default to an HTTP API over a REST API?
For simple Lambda proxy routes — it’s cheaper and lower-latency.
Whenever you need API keys, usage plans, and request validation built in.
Only when the API must integrate with AWS WAF and response caching.
Whenever the API is public rather than private within a VPC.
2. What does a Lambda proxy integration pass to the function?
Only the request body, with the headers and path stripped out.
A pre-validated object matching a schema defined in the gateway.
The whole request, which the handler parses itself.
Nothing — the gateway invokes the handler with an empty event.
3. You need API keys, usage plans, and request transformation. Which API type fits?
HTTP API, because it supports every feature a REST API does.
REST API, which carries those richer features.
Neither — those features require a completely separate AWS service.
HTTP API, after enabling its optional advanced-features mode.
4. What is the difference between a proxy and a request-transform integration?
Proxy validates the request; transform passes it through untouched.
Proxy works only with REST APIs; transform works only with HTTP APIs.
Proxy encrypts the payload while transform leaves it in plaintext.
Proxy forwards the raw request; transform maps it first.
3
Topic 3 of 5
Packaging — layers, ARM64, the Node 24 runtime, and Powertools
Why Do I Need to Know This?
How a Lambda is packaged affects its cost, cold-start size, and observability. ARM64 is cheaper and often faster; layers keep shared dependencies out of every function bundle; and Powertools gives the same structured, correlation-ID-tagged logging the rest of the capstone uses — so a request can be traced across the Fargate services and the Lambda alike.

Scenario
The team’s webhook Lambda must emit the same correlation-ID-tagged structured logs as the rest of the capstone, run on the cheaper ARM64 architecture, and not re-bundle shared dependencies into every function. They package it accordingly before measuring and shipping it.

Theory
ARM64 (Graviton) is the cheaper default
Lambda functions can run on x86 or ARM64 (Graviton). ARM64 is typically lower-cost and often faster for the same work, which makes it a sensible default for new functions. You select it by setting the function’s architecture to arm64.

The Node 24 runtime and layers
The nodejs24.x runtime is current, in long-term support, and supports ES modules (import/export, top-level await). A layer lets multiple functions share common dependencies instead of each bundling its own copy — smaller function packages and one place to update a shared library.

Powertools gives structured, correlation-aware logging
Powertools for AWS Lambda provides Logger, Tracer, and Metrics utilities. The Logger emits structured JSON enriched with the context and a correlation ID, plus a cold-start indicator — so logs from this function join the same traceable stream as the rest of the capstone. The AGENTS.md rule for this module is that Lambdas use the Powertools logger with a correlation ID, the same identifier threaded through the events in 6.2 Reliable Eventing: Outbox, Sagas, DLQs & Idempotency.

What goes into a packaged Lambda
The function runs on ARM64 with the Node 24 runtime, pulls shared code from a layer, and logs through Powertools with a correlation ID.

Lambda function

ARM64 + Node 24 runtime (ESM)

Shared layer: common dependencies

Powertools Logger: correlation ID in structured logs

Example
a handler with powertools logging on arm64
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: "filing-webhook" });   // (1) structured JSON logger

export const handler = async (event, context) => {
  logger.addContext(context);                    // (2) Lambda context: fn name, request id, cold-start
  logger.setCorrelationId(event, "requestContext.requestId"); // (3) correlation ID, set separately
  logger.info("filing webhook received", { route: "/filings" }); // (4) one structured, correlatable line
  // ... process ...
  return { statusCode: 202, body: JSON.stringify({ accepted: true }) };
};

// function architecture: arm64   (set in the function config, not the handler)
Copy
Annotation (1) — the Powertools Logger emits structured JSON, not free-text, so logs are queryable and consistent with the rest of the capstone.
Annotation (2) — addContext(context) takes the Lambda context (the handler’s second argument) and enriches every log line with the function name, request id, memory, and cold-start flag. On its own it does not set a correlation ID.
Annotation (3) — the correlation ID is set separately by setCorrelationId, here pulling the API Gateway request id out of the event; this is the identifier that lets you follow one request across this function and the services it calls.
Annotation (4) — a single structured log line now carries the Lambda context, the correlation ID, and a cold-start flag; the arm64 architecture is set in the function configuration, not in code.
AI Practice
Prompt it
Have Codex add Powertools logging and set ARM64, then verify a correlation ID appears in the logs.

Add Powertools structured logging to our Node 24 filing-webhook Lambda: create a
Logger with a serviceName, add the Lambda context and set a correlation ID from the
request id so logs are correlatable, and emit a structured info line per invocation. Configure the function to run on arm64. Show the handler and the function architecture setting.
Copy
Watch out
Codex often logs with console.log instead of the Powertools Logger (losing structure and the correlation ID), passes event.requestContext to addContext (it expects the Lambda context argument), or adds the context but never sets a correlation ID (addContext alone does not set one). Confirm the Powertools Logger is used, the Lambda context is added and a correlation ID is set via setCorrelationId, and the function is set to arm64.

Verify
Invoke the function and confirm its log output is structured JSON carrying a correlation ID and a cold-start indicator, not free-text. Confirm the function architecture is arm64. Confirm a shared dependency lives in a layer rather than re-bundled. Record any console.log usage, missing correlation ID, or x86 default in your prompt journal.

Knowledge Check
1. Why choose ARM64 (Graviton) for a Lambda function?
ARM64 is the only architecture that supports the Node 24 runtime.
ARM64 removes cold starts entirely for Node.js functions.
It is typically cheaper and often faster than x86.
ARM64 lets the function exceed the 15-minute timeout limit.
2. What do Lambda layers let you avoid?
Re-bundling shared deps into every function package.
Writing any handler code at all for simple proxy integrations.
Paying for invocations while the function sits idle and unused.
Cold starts, by keeping one environment permanently warm always.
3. What does the Powertools Logger add to a function’s logs?
A second copy of every log line stored elsewhere for redundancy.
Automatic deletion of logs older than the configured retention window.
A guarantee that no log line is ever dropped under heavy load.
Structured JSON with a correlation ID and cold-start flag.
4. Why does the program require Powertools structured logging with a correlation ID?
Because Lambda cannot write to CloudWatch without Powertools installed.
So a request can be traced across functions and services.
Because structured logs make every cold start measurably faster.
Because the Node 24 runtime refuses to start without it.
4
Topic 4 of 5
The decision — when Lambda beats Fargate (and when it doesn't)
Why Do I Need to Know This?
This is the lesson’s payoff and the stakeholder briefing: when Lambda beats Fargate. Choosing serverless versus always-on is an architectural decision the team must defend with criteria, not pick by novelty — and it is recorded in ADR-0021 so the next engineer sees the reasoning. Having built a Lambda and run Fargate services, the team can now compare them on real terms.

Scenario
The review panel asks why the team put the webhook on Lambda but kept the main API on Fargate. "Lambda is newer" is not an answer. The team needs explicit, measured criteria — traffic shape, run duration, latency tolerance, and cost — and writes them down in ADR-0021.

Theory
Where Lambda wins
Lambda fits spiky, low, or zero-baseline traffic, short tasks, and event-driven or scheduled work: a webhook, a cron job, an image-resize triggered by an upload. It scales to zero (idle costs nothing), scales out automatically under bursts, and removes server management entirely. The trade-offs are cold-start latency and the 15-minute cap.

Where Fargate wins
Fargate fits steady, high traffic, long-running or always-connected workloads, and anything needing predictable latency (no cold start) or a runtime longer than 15 minutes. The capstone’s main API — always on, latency-sensitive — stays on Fargate for exactly these reasons, as decided in 7.3 ECS Fargate & ALB.

The decision is per-workload and measured
There is no single right answer for the whole system; the choice is made per workload against measurable traits — traffic shape, run duration, latency tolerance, and cost. The team measured the webhook’s cold start and p95 latency to back the call, and ADR-0021 records the criteria and the numbers so the decision is defensible, not a matter of taste.

!
Important
Back the decision with measurement, not preference. ADR-0021 should tie each criterion to data — the measured cold start, the p95 latency, the traffic profile — so "Lambda for the webhook, Fargate for the API" is a defensible engineering decision. Note that LocalStack does not reproduce real cold-start latency, so the binding measurements are taken on real AWS in Week 8.

Choosing Lambda or Fargate per workload
The decision follows the workload’s traffic shape and run duration, not a blanket preference.

yes

no -- steady high traffic

yes

no -- long-running

New workload

Spiky, low, or zero-baseline traffic?

Short tasks, under 15 minutes?

Fargate: always-on, no cold start

Lambda: scale to zero, pay per use

Example
the decision criteria behind adr-0021
Workload trait        →  Lambda            Fargate
--------------------------------------------------------------
Traffic shape         →  spiky / low       steady / high
Idle cost             →  zero              pays while running
Run duration          →  < 15 min          unbounded
Latency tolerance     →  cold start OK     predictable, no cold start
Examples              →  webhook, cron     main API, long connections

Team decision (ADR-0021):
  - filing-webhook  → Lambda  (a few calls/hour, short, cold start acceptable)
  - main filing API → Fargate (always-on, latency-sensitive, > 15 min sessions)
  Measured: webhook cold start ~Xms, warm p95 ~Yms  (real numbers from AWS, Week 8)
Copy
Each row is a criterion the team can point to, not an opinion — traffic, idle cost, duration, latency.
The webhook goes to Lambda because it is rare and short and tolerates a cold start; the main API stays on Fargate because it is always-on and latency-sensitive.
AI Practice
Prompt it
Have Codex draft ADR-0021 from the criteria, then verify each claim is backed by a measurement, not an assertion.

Draft ADR-0021, our ECS-vs-Lambda decision criteria. Lay out the traits that favor
each (traffic shape, idle cost, run duration, latency tolerance) and apply them to
two workloads: the filing-webhook (a few calls/hour, short) and the main filing API
(always-on, latency-sensitive). State the decision for each and leave placeholders
for the measured cold start and p95 we will fill in from real AWS in Week 8.
Copy
Watch out
Codex tends to justify the choice with vague generalities ("Lambda is modern and scalable") instead of the workload’s measured traits, or recommend moving everything to Lambda regardless of fit. It may also claim cold-start numbers without a measurement. Confirm each criterion ties to a real trait of the workload and that any latency number is marked as measured (and where).

Verify
Read ADR-0021 and confirm each decision cites a concrete criterion — traffic shape, duration, latency, cost — not a preference. Confirm the main API stays on Fargate for stated reasons and the webhook goes to Lambda for stated reasons. Confirm cold-start and p95 figures are marked as measured on real AWS (Week 8), not invented. Record any preference-based justification in your prompt journal.

Knowledge Check
1. The team’s main API serves steady, high traffic with strict latency needs. Lambda or Fargate?
Lambda, because it always costs less than Fargate at any scale.
Lambda, because cold starts only ever affect the very first request.
Either works identically; the choice is purely a matter of taste.
Fargate — always-on, no cold start, predictable latency.
2. A nightly cron job runs for 2 minutes. Which fits, and why?
Fargate, because cron jobs cannot run on Lambda at all.
Lambda — it scales to zero, so idle nights are free.
Fargate, because 2 minutes exceeds the Lambda timeout.
Either, but Lambda is disallowed for any scheduled work.
3. What backs the ECS-vs-Lambda decision in ADR-0021?
The personal preference of whoever writes the task definition that week.
Whichever option the previous sprint’s team happened to pick before.
Measured traffic shape, duration, latency, and cost.
The default that AWS recommends in its console for new accounts.
4. Why is the Lambda-versus-Fargate choice made per workload rather than once for the whole system?
Different workloads have different traffic and duration shapes.
Because AWS forbids running Lambda and Fargate in the same account.
Because the choice must match whatever the SPA front end was built with.
Because Fargate and Lambda cannot coexist behind one load balancer.
5
Topic 5 of 5
Practice — ship one Lambda workload and write ADR-0021
Why Do I Need to Know This?
This lesson’s payoff is one capstone workload running serverless and a defensible decision behind it: a Node 24 Lambda on ARM64 with Powertools logging, fronted by an API Gateway HTTP API with a proxy integration, plus ADR-0021 stating when Lambda beats Fargate. The way to know you have it is to build the route on LocalStack with Codex and then attack the choices — confirm init is outside the handler, the integration shape matches the handler, the logs carry a correlation ID, and ADR-0021’s claims are tied to measurements rather than preference.

AI Practice
Prompt it
Hands-on practice for this lesson — build the Lambda workload on LocalStack with Codex, then break each guarantee.

On LocalStack, ship one capstone workload as serverless: a Node 24 Lambda (arm64)
for the filing-webhook with the database client initialized outside the handler;
an API Gateway HTTP API with a POST /filings proxy integration to it; Powertools
structured logging with a correlation ID; and a shared layer for common deps. Then
draft ADR-0021 deciding Lambda for the webhook and Fargate for the main API, with
placeholders for cold-start and p95 to measure on real AWS. Show the handler, the
route/integration, the logging setup, and the ADR.
Copy
Watch out
Codex is likely to initialize the database client inside the handler, default to a REST API or a non-proxy integration that mismatches the handler’s event shape, log with console.log instead of Powertools, leave the architecture on x86, and justify ADR-0021 with generalities instead of measured traits. Each may still "work" on LocalStack while breaking a guarantee. Read where init lives, the API type and integration shape, the logging, the architecture, and whether the ADR cites measurements before trusting it.

Verify
Deploy to LocalStack and confirm a POST to /filings invokes the Lambda through the proxy integration and returns its response. Confirm init is outside the handler, the function is arm64, and logs are structured JSON with a correlation ID. Confirm ADR-0021 decides per workload with criteria, marking cold-start and p95 as measured on real AWS (Week 8), not invented. Record every guarantee that failed on the first pass in your prompt journal.

