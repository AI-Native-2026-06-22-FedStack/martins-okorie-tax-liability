# ADR-0006: Service Boundaries and Anti-Shared-DB Rule

- Status: Proposed

## Context

TaxPulse now has a Node/Express Core Case Service and a Python/FastAPI Domain Compute service. The services need to collaborate for synchronous real-time tax-liability calculation without letting a database schema change in one service silently break the other.

Over-splitting by table would create noisy ownership boundaries, but a shared database would create hidden coupling. We need a bounded-context decision that names the business owners, their datastores, their tenant-isolation strategies, and the rule for cross-context access.

## Decision

The Node Core Case Service (`apps/api`) owns the Plan Cycle Case context and the identity and auth context. It owns and writes the Core Case PostgreSQL datastore for Tax Plan Cycle cases, workflow stage transitions, audit records, users, credentials, MFA enrollment state, refresh-token records, roles, and tenant-scoped authorization facts. Tenant isolation in this context is enforced with tenant-scoped JWT claims, route guards, repository methods that require `tenant_id`, and tenant-keyed database rows.

The FastAPI Domain Compute service / Tax Engine (`services/compute`) owns tax-liability calculations. It owns and writes only the Tax Engine datastore for calculation-owned persistence, such as calculation runs, model inputs, derived outputs, or compute audit records. Tenant isolation in this context is enforced by verifying Node-issued RS256 JWTs with the Tax Engine public key, deriving tenant context from verified token claims, and tenant-keying any Tax Engine records.

The Core Case Service calls the Tax Engine through the Tax Engine HTTP API. For this sprint, that call remains synchronous: the Core Case Service invokes `POST /compute/tax-liability` with a Node-issued bearer token, and the Tax Engine verifies the token before calculating.

We adopt an anti-shared-DB rule:

- A service reaches another service's data only through that service's API.
- Cross-boundary direct database reads are forbidden.
- Cross-boundary direct database writes are forbidden.
- Cross-boundary database joins are forbidden.
- Schema changes inside one service's datastore must not be treated as an integration contract for another service.

## Consequences

- The Core Case Service can evolve Plan Cycle Case, workflow, audit, identity, and auth schemas without creating hidden database dependencies in the Tax Engine.
- The Tax Engine can evolve calculation-owned schemas without breaking Core Case reads through a shared database join.
- Cross-context integration risk moves to explicit HTTP API contracts, where it can be versioned, documented, and tested.
- Synchronous Node-to-Python calls still require timeout, retry, and failure-handling discipline because the Core Case request path waits for the Tax Engine response.

## Alternatives Considered

- Shared PostgreSQL database with direct reads across services: Rejected. It would make schema changes in one context capable of silently breaking the other and would invite cross-context joins.
- Shared database with direct writes across services: Rejected. It would blur ownership, bypass the owning service's invariants, and make audit responsibility unclear.
- One service per table: Rejected. TaxPulse's current capabilities are better represented as two coherent contexts: Core Case plus identity/auth, and Tax Engine calculations.
- Fully asynchronous compute boundary for this sprint: Deferred. It may be useful for long-running calculations later, but the current sprint keeps the Node-to-Python calculation call synchronous.

## References

- [TaxPulse service boundaries](../boundaries.md)
