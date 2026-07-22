# ADR-0004: Audit Log Schema

## Context
Wealth-advisor firms require auditable tax-liability planning cycles for high-net-worth clients. We need to record consequential business actions, allowed operations, and unauthorized/denied transition attempts to track tenant activity safely.

## Decision
We define a rigid five-field audit log schema, validated at write time to ensure completeness:

1. **actor** (who): The email or system identifier performing the action.
2. **action** (what): The event descriptor (e.g. `cycle.transition.success`, `cycle.transition.denied`).
3. **timestamp** (when): The ISO 8601 UTC date/time of the event.
4. **reason** (why): The business context or reasoning behind the transition.
5. **result** (outcome): A closed enum of `success` or `failure`.

### Storage & Append-Only Enforcement
Audit logs are stored in the database `audit_entry` table. We enforce append-only behavior at the database layer using a Postgres trigger that raises an exception and blocks any attempted `UPDATE` or `DELETE` operations on the table.

### Logging Redaction
To prevent sensitive financial data leakage (income/deductions), dollar figures are redacted at render/serialization time before output.

## Consequences
* Every recorded audit event is complete, structured, and queryable.
* Database-level triggers guarantee data tamper-proofing.
* Sensitive client numbers are safely excluded from rendered audit trails.
