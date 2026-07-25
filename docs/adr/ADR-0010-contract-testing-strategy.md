# ADR-0010: Consumer-Driven Contract Testing Strategy for TaxPulse Inter-Service Communication

* Status: accepted
* Deciders: TaxPulse Advisory Engineering Team
* Date: 2026-07-23

## Context and Problem Statement

TaxPulse relies on inter-service communication between the Express Core Case Service (`taxpulse-api`) and the FastAPI Tax Engine (`compute-engine`). While versioned JSON Schemas define static data shapes, they do not verify that the running provider endpoint actually fulfills the consumer's executable expectations. We need a contract testing strategy that prevents breaking changes from reaching production while avoiding over-engineering for external third-party integrations.

## Decision Drivers

* Internal ownership of both Express Core and FastAPI Tax Engine microservices.
* Prevention of breaking contract changes during independent CI/CD build cycles.
* Avoiding brittle, one-sided mocks for third-party external services we do not own.

## Considered Options

1. **Consumer-Driven Contract Testing (Pact)**: The consumer (`taxpulse-api`) defines its executable expectations; the provider (`compute-engine`) verifies them.
2. **Producer-Driven Contract Testing**: The provider publishes its full API specification, and consumers adapt to it.
3. **End-to-End Integration Testing Only**: Test both services together in an integrated staging environment.

## Decision Outcome

Chosen option: **Consumer-Driven Contract Testing (Pact)** for internal services owned by the team, combined with targeted integration tests for external third-party services.

### Integration Classification Matrix

| Integration | Type | Owner | Strategy | Rationale & Alternative Check |
| --- | --- | --- | --- | --- |
| **Express Core → FastAPI Tax Engine** (`POST /v1/calculate`, `POST /v1/scenario`) | Internal Microservice | Team Owned | **Pact Consumer-Driven Contract** | We own both sides; consumer expectations pin the exact fields used (`federal_liability`, `state_liability`, `effective_rate`, `marginal_rate`, `quarterly_estimate`, scenario deltas). Provider verifies via Pact Broker in CI before deploy. |
| **FastAPI Tax Engine → Third-Party Tax-Rate API** (e.g. TaxJar / AvaTax / State Dept of Rev) | External 3rd Party API | Third Party | **Integration Test with Recorded Fixtures (VCR/Nock)** | We do NOT own or control the third-party provider, so we cannot execute provider verification in CI. A Pact test would create a brittle one-sided mock. Alternative: recorded HTTP response fixtures in integration tests. |

## Consequences

* Positive: Consumer expectations are verified against the real running provider in CI before deployment.
* Positive: Irrelevant provider response fields ignored by the consumer can evolve freely without breaking builds.
* Negative: Requires running and maintaining a local Pact Broker service during development and CI.
