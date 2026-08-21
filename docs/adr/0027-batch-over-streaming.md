# 0027. Batch Over Streaming for Analytical Corpus Ingestion

- Status: Accepted

## Context

The TaxPulse analytical pipeline ingests vendor income-event exports to compute cycle-level tax liabilities, effective rates, and year-over-year deltas for advisory clients. The downstream AI-Assist retrieval index and plan-cycle dashboard require corpus freshness within **15 minutes** of new vendor data generation. We must decide between an EventBridge-scheduled 15-minute batch pipeline and an always-on streaming architecture (e.g., Amazon Kinesis / Apache Kafka consumers).

## Decision

We adopt a **scheduled batch pipeline** running every 15 minutes via EventBridge, executing the five-stage analytical workflow (`extract` -> `validate` -> `transform` -> `load` -> `publish`). 

Batch processing fulfills the 15-minute SLA at substantially lower operational complexity, infrastructure cost, and compute overhead compared to always-on streaming consumers. Furthermore, the pipeline's fifth stage (`publish`) already emits standard CloudEvents notifications over SNS/SQS, ensuring an evolutionary upgrade path to streaming should true sub-second latency requirements emerge in the future.

## Consequences

### Positive
- **Operational Simplicity**: Eliminates the burden of managing always-on consumer daemon pools, checkpoint state stores, stream partition rebalancing, and out-of-order deduplication windows.
- **Cost Efficiency**: Compute resources execute ephemerally on a 15-minute clock rather than incurring 24/7 idle infrastructure costs.
- **Auditable Reconciliation**: Cross-engine batch reconciliation (Polars vs. DuckDB vs. PostgreSQL) executes over deterministic point-in-time snapshots with exact row conservation counts.
- **Upgrade Ready**: Emits domain refresh events over the existing Module 6 SNS fabric, preserving backwards compatibility for future real-time subscribers.

### Negative / Trade-offs
- Corpus updates are batched on a 15-minute boundary rather than reflecting event-time immediacy.

## Alternatives Considered

1. **Always-On Kinesis/Kafka Streaming Pipeline**: Rejected because 24/7 consumer processes, lease management, and complex stream checkpointing add unjustified operational burden for a 15-minute freshness requirement.
2. **On-Demand Manual Ingest**: Rejected because manual invocation lacks deterministic SLA guarantees and automated error detection.
