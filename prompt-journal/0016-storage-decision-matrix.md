# Prompt Journal: Storage Decision Matrix

## Entry 1

Asked — Add the attached Week 4 Day 2 "The Storage Decision Matrix" lesson as a helper and start a new prompt journal.

Produced — Added `helper/week-4-day-2-storage-decision-matrix.md` from the attached lesson text and started this new Week 4 Day 2 prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 4 Day 2 helper content is now available in the repo, and the storage decision matrix work has its own sequential prompt journal.

## Entry 2

Asked — Implement the Week 4 Day 2 documentation-only storage decision matrix deliverable with ADR-0009, a checked-in Mermaid C4 store map, a cost table, README/ADR index links, and no running service changes.

Produced — Added ADR-0009 with the TaxPulse store decision matrix, Postgres/DynamoDB/Redis placements, and anti-pattern review; added `store-map.mmd` as a C4 container-level Mermaid map; added `cost-estimate.md` with 1x/10x/100x DynamoDB read-cost math and a cached 100x case; and linked the ADR from the README and ADR index.

Accepted or rejected — Accepted.

Why — The deliverable is represented as discoverable documentation under `docs/adr`, with Redis documented only as cache/idempotency storage and DynamoDB documented as the key-shaped Plan Cycle Queue read model rather than a cache.

## Entry 3

Asked — Tighten ADR-0009 for Task 1 so it uses MADR format and explicitly places transactional case data, the Plan Cycle Queue read model, idempotency keys, and cached queue reads with six-factor rationale, ownership, and consistency expectations.

Produced — Rewrote ADR-0009 with the MADR title/status format, a focused four-row six-factor matrix, a bounded-context ownership note, links to the store map and cost table, consequences, and alternatives rejected.

Accepted or rejected — Accepted.

Why — ADR-0009 now names one store per required concern and cites the factors that drive each placement, with Redis documented only for temporary cache/idempotency concerns.
