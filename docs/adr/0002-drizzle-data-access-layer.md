# 2. Use Drizzle as the TypeScript data-access layer

- Status: Accepted

## Context

TaxPulse already has committed raw SQL migrations for tenant isolation, Tax Plan
Cycles, and stage-transition history. The API now needs a TypeScript data-access layer
that keeps table shape, repository types, and future generated migrations close to the
database model without hiding SQL behavior.

Drizzle provides a TypeScript-first schema, inferred select and insert types, and
generated PostgreSQL migrations while keeping the SQL model visible.

## Decision

Use Drizzle ORM as the API data-access layer.

Define the table shape once in `apps/api/src/db/schema.ts`, mirror the existing
Deliverable 1 PostgreSQL schema, and have repositories and services import Drizzle's
inferred table types instead of hand-declaring row shapes.

Keep the historical raw SQL migrations under `apps/api/db/migrations/` as the record of
the first delivered schema. Use Drizzle-generated migrations under `apps/api/drizzle/`
for new schema work after the Drizzle schema is established.

## Consequences

- Repositories can share one table definition with migration generation and TypeScript
  row types.
- SQL constraints remain visible in the schema instead of moving only into application
  code.
- Generated migrations must be reviewed against the existing database model before they
  are accepted.

## Accepted risks

- Drizzle has a smaller ecosystem than Prisma. Mitigation: prefer plain SQL-visible
  patterns, keep repository boundaries small, and verify unfamiliar Drizzle APIs against
  official documentation before merging.
- Drizzle does not produce automatic down migrations. Mitigation: use forward-only
  migration discipline and document any rollback as an explicit follow-up migration or
  operational restore step.
- AI tools have weaker priors for Drizzle than for older ORMs. Mitigation: check
  generated Drizzle code against official documentation and database evidence instead of
  accepting AI output from code review alone.

## Alternatives considered

- Keep hand-written SQL only. Rejected because it would leave application row types and
  schema changes manually synchronized.
- Use Prisma. Rejected because this deliverable calls for Drizzle, and Drizzle better
  preserves the SQL-first visibility needed for the current migration path.
