# Prompt Journal: Lambda & API Gateway

## Entry 1

Asked — Save the attached Week 7 Day 4 "Lambda & API Gateway" lesson as a helper and create a new prompt journal.

Produced — Saved `helper/week-7-day-4-lambda-api-gateway.md` from the provided lesson text and initialized `prompt-journal/0029-lambda-api-gateway.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 7 Day 4 Lambda and API Gateway helper lesson is saved in the repository helper directory and prompt journal 0029 is initialized for the new serverless work.

## Entry 2

Asked — Complete Task 1 only by promoting the low-traffic present-to-client workload to a Node 24 ARM64 Lambda with module-scope initialization, Powertools structured logging, a correlation ID, verified-claims role gating, and no database writes from the handler.

Produced — Added `lambda/present-to-client/handler.ts` and `lambda/present-to-client/function.json`; kept setup in initialization code outside the handler; sourced the correlation ID from the proxy event; enforced the Firm Admin role gate from verified JWT claims; forwarded the present-to-client command to the Core Case Service stub instead of writing the database; and verified the floci Lambda config and two-invoke warm reuse with synthetic input.

Accepted or rejected — Accepted.

Why — The handler typechecks, floci readback confirms `nodejs24.x` and `arm64`, and two invocations emitted Powertools JSON logs with the same module-scope `initId` and synthetic correlation ID.

## Entry 3

Asked — Keep the Lambda package manifest and lockfile, then complete Task 2 by fronting the present-to-client Lambda with an API Gateway HTTP API proxy route on floci.

Produced — Restored `lambda/present-to-client/package.json` and `package-lock.json`; added `apigw/http-api.json` with an HTTP API, one `POST /transitions/present-to-client` route, and an `AWS_PROXY` Lambda integration; verified floci readback for the HTTP API, route, integration, and stage; and sent a request through the floci execute-api route that invoked the Lambda and returned its proxy response with the correlation ID.

Accepted or rejected — Accepted.

Why — floci reports `ProtocolType: HTTP`, `IntegrationType: AWS_PROXY`, and `PayloadFormatVersion: 2.0`; a route request returned the Lambda response with `x-correlation-id`, and Powertools logs carried the same correlation ID with the proxy method and path.

## Entry 4

Asked — Complete Task 3 by writing ADR-0021 for the ECS-versus-Lambda decision, with Lambda chosen for the moved present-to-client workload, Fargate kept for the main services, and each criterion backed by a measurement including a floci-modeled cold-start number.

Produced — Added `docs/adr/0021-ecs-vs-lambda.md` in MADR format with measured criteria for traffic shape, run duration, latency tolerance, and idle cost; cited the local floci route timing samples of 1.150339 seconds for the first measured request and 0.055244 seconds for the warm request; labelled the cold-start number as locally modeled on floci and indicative only; and kept the Core Case Service and Tax Engine on Fargate based on their ADR-0020 always-on service measurements.

Accepted or rejected — Accepted.

Why — ADR-0021 now decides per workload using concrete measurements instead of preference language, includes an indicative floci-modeled cold-start figure, and preserves Fargate for the steady, latency-sensitive main services.

## Entry 5

Asked — Verify the Week 7 Day 4 deliverable against the pass signals for Node 24 ARM64 Lambda, Powertools correlation logging, HTTP API proxy routing, and measurement-backed ADR-0021.

Produced — Ran static JSON, TypeScript, formatting, handler source, ADR content, floci Lambda configuration, floci API Gateway route/integration, HTTP route invocation, and Docker log checks.

Accepted or rejected — Accepted.

Why — All pass signals verified: floci reports `nodejs24.x` and `arm64`, the route is an HTTP API with `AWS_PROXY`, the route invokes the Lambda and logs structured JSON with the event correlation ID, and ADR-0021 cites measured criteria with a floci-modeled cold-start figure.
