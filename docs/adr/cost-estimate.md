# DynamoDB Read Cost Estimate

This estimate is attached to [ADR-0009](0009-storage-decision-matrix.md). It prices the key-shaped Plan Cycle Queue/status-style read pattern introduced in Week 4 Day 1.

## Assumptions

- Pattern: tenant-scoped queue/status read from the DynamoDB read model.
- Item size: at or below 4 KB.
- Consistency: eventually consistent for the hot queue read.
- Billing unit: `0.5 RRU` per eventually consistent read at or below 4 KB.
- Baseline volume: `10,000,000` reads/month at `1x`.
- Cache scenario: Redis cache-aside absorbs `90%` of reads at `100x`, so only `10%` reach DynamoDB.
- Price used: `$0.125 per 1,000,000 read request units`, based on the AWS DynamoDB on-demand US East (N. Virginia) pricing example checked on 2026-07-22. Recheck the live AWS pricing page before production or budget approval.

AWS references:

- DynamoDB on-demand mode bills per request and eventual reads consume one-half RRU per 4 KB or part thereof: <https://aws.amazon.com/dynamodb/pricing/>
- The same page's US East on-demand example prices read traffic at `$0.125 per million reads/request units`.

## Monthly estimate

| Load | Reads / month | DynamoDB reads after cache | RRU math | Estimated read cost |
| --- | ---: | ---: | ---: | ---: |
| `1x` | 10,000,000 | 10,000,000 | 10,000,000 x 0.5 = 5,000,000 RRUs | $0.63 |
| `10x` | 100,000,000 | 100,000,000 | 100,000,000 x 0.5 = 50,000,000 RRUs | $6.25 |
| `100x` | 1,000,000,000 | 1,000,000,000 | 1,000,000,000 x 0.5 = 500,000,000 RRUs | $62.50 |
| `100x + 90% Redis hit` | 1,000,000,000 | 100,000,000 | 100,000,000 x 0.5 = 50,000,000 RRUs | $6.25 |

## Interpretation

At `100x`, the uncached read pattern costs about 100 times the `1x` case. A 90% Redis hit rate lowers paid DynamoDB reads from 1 billion to 100 million per month, returning the `100x` read cost to the same cost band as the uncached `10x` case. That is the cost reason Redis cache-aside belongs in front of the DynamoDB read model.

This estimate intentionally excludes writes, storage, backup, data transfer, and optional DynamoDB features. Those should be added when the access pattern or production region is finalized.
