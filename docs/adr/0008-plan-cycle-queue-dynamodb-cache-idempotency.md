# ADR-0008: Plan Cycle Queue Read Model, Cache-Aside, and Idempotent Creates

## Status

Accepted

## Context

The Plan Cycle Queue is a high-volume Advisor read. Rebuilding it from Postgres joins on every refresh is expensive, and retried cycle creation can duplicate Tax Plan Cycles without a write-safety key. Week 4 Day 1 adds DynamoDB and Redis while keeping Postgres as the source of truth.

## Decision

TaxPulse will project Plan Cycle Queue rows from Postgres into a DynamoDB single-table read model and cache queue reads in Redis. `POST /v1/cycles` accepts an optional `Idempotency-Key` header scoped to the verified JWT tenant claim.

Access patterns are written before keys:

| Access pattern                                                        | Consistency mode           | Why                                                                                           | Store command              |
| --------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| List a tenant stage queue ordered for display                         | Eventual                   | The queue is a read model; a short projection/cache lag does not change the Postgres truth.   | DynamoDB `Query`           |
| Read one projected cycle by tenant and cycle id                       | Strong/read-your-own-write | Verification after a write must not miss the just-projected cycle item.                       | DynamoDB `Query`           |
| List overdue cycles by tenant ordered by due date                     | Eventual                   | Overdue is recomputed at projection time for queue display and can tolerate read-model lag.   | DynamoDB `Query`           |
| List an Advisor queue by tenant, owner, and stage ordered by due date | Eventual                   | This is a filtered Advisor work queue where the base tenant item collection cannot key owner. | DynamoDB `Query` on `GSI1` |
| Refresh the projection after cycle create or transition               | Write                      | Projection happens after the Postgres write and recomputes derived fields such as `overdue`.  | DynamoDB `BatchWriteItem`  |
| Remove stale queue placement when stage, due date, or owner changes   | Write                      | Old queue and overdue placements must be deleted before the fresh projection is inserted.     | DynamoDB `BatchWriteItem`  |

Derived single-table layout:

| Projection item            | Key                                                                                                   | GSI                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Cycle by id                | `PK=TENANT#<tenant_id>`; `SK=CYCLE#<cycle_id>`                                                        | none                                                                                                                  |
| Tenant stage queue display | `PK=TENANT#<tenant_id>`; `SK=QUEUE#STAGE#<stage>#DUE#<due_date>#PRIORITY#<priority>#CYCLE#<cycle_id>` | `GSI1PK=TENANT#<tenant_id>#OWNER#<owner>#STAGE#<stage>`; `GSI1SK=DUE#<due_date>#PRIORITY#<priority>#CYCLE#<cycle_id>` |
| Overdue by due date        | `PK=TENANT#<tenant_id>`; `SK=OVERDUE#DUE#<due_date>#CYCLE#<cycle_id>`                                 | none                                                                                                                  |

Every item carries `id`, `tenant_id`, `client_id`, `planning_period`, `stage`, `owner`, `priority`, `due_date`, `on_hold`, `hold_reason`, and the projected `overdue` flag. The table uses on-demand capacity for spiky local/demo traffic. The one GSI exists only for the Advisor owner+stage access pattern that the base tenant item collection cannot serve directly.

Redis keys:

| Purpose            | Key                                              |
| ------------------ | ------------------------------------------------ |
| Queue cache        | `queue:<tenant_id>:<stage>:<owner\|all>:<limit>` |
| Queue rebuild lock | `queue-lock:<queue-cache-key>`                   |
| Idempotency replay | `idem:<tenant_id>:<Idempotency-Key>`             |
| Idempotency lock   | `lock:<tenant_id>:<Idempotency-Key>`             |

## Consequences

- Queue reads must use DynamoDB `QueryCommand`; `ScanCommand` is not acceptable for the required access patterns.
- Cycle create and transition synchronously refresh the projection and invalidate tenant queue cache entries.
- A retry with the same tenant and `Idempotency-Key` replays the original status and body for 24 hours.
- A concurrent request with the same tenant and key waits on the Redis `SET NX PX` lock and replays the first completed response instead of inserting a duplicate.
- `409 Request in progress` is retained only as a timeout fallback when no final response is stored before the lock wait window closes.
- The Redis lock is single-node only and is not a production multi-Redis locking design.
