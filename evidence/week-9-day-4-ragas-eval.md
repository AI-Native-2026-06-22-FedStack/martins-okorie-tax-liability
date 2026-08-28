# Week 9 Day 4: RAGAS Quality Gate & Retrieval Evidence

## 1. HNSW Index Verification & Live Query Plan

- **Migration**: `apps/api/db/migrations/0005_chunk_vector_index.sql`
- **Index**: `retrieval.corpus_chunk_embedding_hnsw_idx`
- **Method / Operator**: HNSW with `vector_cosine_ops` (`m=16`, `ef_construction=64`)
- **Query Plan Verification**: Executed `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` against live PostgreSQL 17.11 (`pgvector 0.8.6`).
- **Dedicated Evidence File**: [evidence/hnsw-query-plan.md](evidence/hnsw-query-plan.md)
- **Live Automated Test**: `test_hnsw_index_scan_query_plan` in `services/retrieval/tests/test_retrieve.py`.

### Raw Execution Plan Output

```text
Limit  (cost=128.23..132.23 rows=10 width=172) (actual time=0.462..0.580 rows=10 loops=1)
  Output: chunk_id, tenant_scope, source, section, chunk_offset, content, ((embedding <=> '[-0.022064209, ...]'::vector))
  Buffers: shared hit=96
  ->  Index Scan using corpus_chunk_embedding_hnsw_idx on retrieval.corpus_chunk  (cost=128.23..140.62 rows=31 width=172) (actual time=0.461..0.577 rows=10 loops=1)
        Output: chunk_id, tenant_scope, source, section, chunk_offset, content, (embedding <=> '[-0.022064209, ...]'::vector)
        Order By: (corpus_chunk.embedding <=> '[-0.022064209, ...]'::vector)
        Buffers: shared hit=96
Planning:
  Buffers: shared hit=28
Planning Time: 0.155 ms
Execution Time: 0.715 ms
```

- **Retrieval Test**: Verified question `"For TPX-RP-001-B, what maximum reserve applies to the single filer threshold table?"` returns expected chunk `TPX-RP-001-B-001`.


---

## 2. RAGAS Quality Gate Results

- **Judge Model**: `gpt-4o-mini` (Resolved: `gpt-4o-mini-2024-07-18`)
- **Embeddings Model**: `text-embedding-3-small`
- **Dataset**: `services/retrieval/eval/eval_set.jsonl` (20 human-reviewed test pairs)
- **Smoke Dataset**: `services/retrieval/eval/eval_smoke.jsonl` (5 items for wiring proof)

### Metric Thresholds vs Recorded Scores

| Metric | Threshold | Recorded Score | Status | Metric Failure Diagnosis |
| :--- | :---: | :---: | :---: | :--- |
| **Faithfulness** | `>= 0.85` | **0.8608** | **PASS** | If low: Generator hallucinated ungrounded claims |
| **Answer Relevancy** | `>= 0.85` | **0.8520** | **PASS** | If low: Response drifted or failed to address the prompt |
| **Context Precision** | `>= 0.80` | **0.9250** | **PASS** | If low: Retriever returned noisy / irrelevant chunks |

*Note: Metrics are asserted individually in `test_ragas_gate.py` to ensure high generation quality cannot mask retriever collapse.*

---

## 3. Red/Green Wiring Proof (Smoke Suite)

1. **Normal Baseline**:
   - `faithfulness: 1.0000` (PASS)
   - `answer_relevancy: 0.8840` (PASS)
   - `context_precision: 1.0000` (PASS)
2. **Degraded Prompt (`DEGRADE_PROMPT=1`)**:
   - `faithfulness: 0.7167` (FAIL - Turns **RED** below 0.85 threshold)
   - Demonstrates that the gate catches generator regressions and stops bad deploys.
3. **Reverted Prompt (`DEGRADE_PROMPT=0`)**:
   - Returns to green baseline (`faithfulness: 1.0000`, `answer_relevancy: 0.8840`, `context_precision: 1.0000`).

---

## 4. Operational Cost and Judge Model

- **Resolved Model ID**: `gpt-4o-mini-2024-07-18`
- **Judge Calls (20 examples)**: 60 calls
- **Token Usage**: ~21,000 input tokens, ~4,500 output tokens
- **Estimated Cost per CI Run**: **$0.0058 USD** (< $0.01 per run)
- **CI Workflow**: `.github/workflows/ai-quality.yml` configured as required status check.
