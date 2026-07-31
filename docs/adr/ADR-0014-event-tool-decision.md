# ADR-0014 — Stage-Changed Event Fan-Out with SNS and SQS

- Status: Accepted

## Context

TaxPulse now needs a durable event path for facts emitted by the Core Case Service when a Tax Plan Cycle changes workflow stage. The event must be self-describing for auditability, consumable by independent subscribers, and runnable locally without a real AWS account or cost.

The first event is `com.taxpulse.tax-plan-cycle.stage.changed.v1`, a CloudEvents 1.0 fact emitted after an authorized stage transition succeeds. Consumers must be idempotent because standard SQS is at-least-once.

The shared schema lives at `packages/shared-schemas/src/events/stageChanged.ts`. Version `v1` carries the Tax Plan Cycle id, tenant id, from-stage, to-stage, actor, and change timestamp inside the CloudEvents `data` payload. The CloudEvents `id` is the consumer dedupe handle.

## Decision

Use SNS plus SQS for the Week 6 Day 1 stage-changed fan-out:

| Concern | Decision |
| --- | --- |
| Event contract | CloudEvents 1.0 envelope validated with zod in `packages/shared-schemas` |
| Stage-changed schema version | `v1`, exposed as `stageChangedSchemaVersion` |
| Local AWS emulator | LocalStack at `http://localhost:4566` |
| Fan-out transport | SNS topic `taxpulse-stage-changed` |
| Durable consumer buffer | Standard SQS queue `taxpulse-stage-changed-projection` |
| Poison-message handling | SQS dead-letter queue `taxpulse-stage-changed-dlq` with redrive after 3 receives |
| Consumer dedupe | Reuse the existing Redis store with event-id scoped keys; no new dedupe store |
| Projection | Redis current-stage projection keyed by tenant and Tax Plan Cycle id |

SNS/SQS is the right first tool because every subscribed consumer should receive the same stage-changed fact, and each consumer needs its own durable backlog. The queue is standard rather than FIFO because stage-changed fan-out values throughput and independent consumer backlog over strict per-cycle ordering; consumers must dedupe by CloudEvents `id` because standard SQS is at-least-once. EventBridge remains the better future choice for content-based routing, archive/replay, and stronger event governance. Kinesis is not selected for this workflow because stage transitions are discrete workflow facts, not high-volume ordered stream analytics.

The first consumer writes a read-side current-stage projection to Redis under `projection:stage-changed-current-stage:<tenant_id>:<cycle_id>`. The value records the current stage, prior stage, actor, change timestamp, CloudEvents id, and projection timestamp. This projection is intentionally rebuildable and short-lived; PostgreSQL remains the source of truth for Tax Plan Cycles and stage-transition history.

## Consequences

- Producers publish a past-tense fact and do not name consumers.
- Consumers validate the CloudEvents schema at the boundary.
- Standard SQS consumers must dedupe by CloudEvents `id` before projecting.
- The consumer long-polls SQS and deletes messages only after validation, dedupe, and projection succeed.
- Poison messages are left undeleted so SQS can move them to the DLQ.
- The current implementation does not introduce a transactional outbox; a publish failure is logged after the committed stage transition. Reliable outbox semantics should be addressed in the next reliable-eventing module.

## Alternatives Considered

- **Direct service call from the transition route to a projection worker**: Rejected because the producer would know the consumer and the workflow would be tightly coupled.
- **SNS direct subscription without SQS**: Rejected because offline consumers would not have an independent durable buffer.
- **EventBridge for the first fan-out**: Rejected here because the immediate need is fixed fan-out from one stage-changed fact to durable consumer queues. EventBridge content routing, archive/replay, and schema governance are valuable later when TaxPulse needs routed event types or replay as an operational/audit workflow, but they are not required for this first fixed subscriber path.
- **Kinesis stream**: Rejected here because stage transitions are discrete workflow facts that need durable fan-out and a DLQ, not ordered retained stream processing or shard-based analytics history.
