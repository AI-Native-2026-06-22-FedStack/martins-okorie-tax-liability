# ADR-0021: ECS Fargate vs Lambda, decided per workload

## Status

Accepted

## Context

TaxPulse now has two compute shapes:

- Always-on services from ADR-0020: the Core Case Service and Tax Engine run as ECS Fargate
  services behind the ALB, with one desired task each in the local floci verification.
- A low-traffic present-to-client command stub from the Module 6 saga now runs as
  `taxpulse-present-to-client`, a Node 24 ARM64 Lambda behind an API Gateway HTTP API proxy
  route.

The present-to-client Lambda is a per-event forwarder. It does not write the database
directly; it parses the proxy request, enforces the verified-claims Firm Admin gate, and
forwards the command to the Core Case Service. Local floci verification invoked the route
manually with synthetic input and no background traffic generator, which models the intended
zero-baseline traffic shape for this workload.

## Decision

Choose compute per workload, not per product area.

| Criterion         | Measured present-to-client workload trait                                                                                                                                                                                            | Decision for present-to-client | Measured main service trait                                                                                                                                                                                      | Decision for Core Case Service and Tax Engine |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Traffic shape     | Task 2 verification produced route-driven invocations only; there is no desired-count process and no background poller for this command. The observed local traffic baseline is 0 invocations/hour when no advisor presents a cycle. | Lambda                         | ADR-0020 floci verification runs the Core Case Service and Tax Engine as ECS services with desired count 1 each and repeated health checks. They have a nonzero always-on baseline even with no advisor request. | Fargate                                       |
| Run duration      | The Task 3 local route sample completed in 1.150339 seconds for the first measured request and 0.055244 seconds for the following warm request, both far below the 900-second Lambda cap.                                            | Lambda                         | The Core Case Service and Tax Engine are long-running HTTP services. ADR-0020 verified them as running ECS tasks with readiness health checks rather than finite invocations.                                    | Fargate                                       |
| Latency tolerance | The moved command is an advisor workflow edge. Local modeled cold-start route latency was 1.150339 seconds on floci, which is acceptable for a present-to-client command stub. This is indicative only, not a production guarantee.  | Lambda                         | The main services serve interactive API and real-time tax-liability calculation paths. ADR-0020 keeps them warm behind an ALB so requests do not wait for function environment startup.                          | Fargate                                       |
| Idle cost         | The Lambda has no desired task count. Local floci state shows the function exists as configuration until invoked, so idle compute is modeled as 0 running tasks for this workload.                                                   | Lambda                         | ADR-0020 intentionally keeps one Core Case Service task and one Tax Engine task running locally to preserve readiness, replacement, and predictable service behavior.                                            | Fargate                                       |

Run `taxpulse-present-to-client` on Lambda using `nodejs24.x`, `arm64`, a 30-second timeout,
and Powertools structured logging with a correlation ID.

Keep the Core Case Service and Tax Engine on ECS Fargate because their measured local shape
is steady, health-checked, and always-on.

## Consequences

- The present-to-client command scales to zero between invocations and avoids paying for an
  idle task dedicated to rare command forwarding.
- The Lambda remains subject to the 15-minute invocation limit; this workload is acceptable
  because the measured local route samples were 1.150339 seconds and 0.055244 seconds.
- The locally modeled cold-start figure is 1.150339 seconds through floci API Gateway to
  Lambda. It is an indicative local model, not a production latency guarantee.
- Production cold-start and p95 latency must be measured again on real AWS before using
  those figures in an external SLO or cost model.
- The main services stay on Fargate, preserving warm process behavior, readiness checks,
  and ALB-backed routing for latency-sensitive Core Case and Tax Engine calls.
