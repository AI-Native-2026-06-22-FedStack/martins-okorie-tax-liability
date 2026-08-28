# Week 9 Day 3 PR — Production RAG Retrieval

## Summary

This PR delivers the Week 9 Day 3 production RAG retriever for TaxPulse. It adds a committed synthetic planning corpus, hierarchical chunking with citation provenance, a unified Postgres chunk table with `tsvector` and `pgvector`, tenant-scoped hybrid retrieval with Reciprocal Rank Fusion, one-call-per-question reranking, frozen-pool evaluation, and ADR-0028 documenting the retrieval decisions.

## Key Deliverables

1. **Synthetic Planning Corpus**
   - Completed `data/corpus/CORPUS-SPEC.md`.
   - Added 10 synthetic markdown documents under `data/corpus/`.
   - Every document is labelled synthetic, attributed to the Fictional TaxPulse Planning Board, and states that rates and limits are invented.
   - Stable synthetic identifiers use `TPX-RP-###-X` and `TPX-PB-###-X`, intentionally not resembling real tax code citations.

2. **Chunking, Embedding, And Unified Store**
   - Added `services/retrieval/chunker.py` with hierarchical section-based chunking.
   - Added `services/retrieval/embed.py` with idempotent embedding and loading.
   - Added `apps/api/db/migrations/0004_corpus_chunk.sql`, creating `retrieval.corpus_chunk` with provenance, tenant scope, `search_vector tsvector`, and `embedding vector(1536)`.
   - Embedding cache lives under `.cache/embeddings`, which is gitignored.

3. **Tenant-Scoped Hybrid Retrieval**
   - Added `services/retrieval/retrieve.py`.
   - Keyword leg queries `search_vector` and exact synthetic identifiers.
   - Dense leg queries `embedding <=> query_embedding`.
   - Fusion uses RRF by rank only: `sum(1 / (60 + rank))`.
   - Returned results carry score and full provenance.

4. **Rerank Evaluation**
   - Added `services/retrieval/rerank.py`.
   - Added `services/retrieval/eval/seed_pairs.jsonl`, `rankings.jsonl`, `pool.jsonl`, and `precision_at_5.py`.
   - Reranking uses one batched model call per question and caches results by question, ordered candidates, content hashes, resolved model id, prompt version, and rerank config.
   - Resolved rerank model id: `gpt-4o-mini-2024-07-18`.

5. **ADR And Evidence**
   - Added `docs/adr/0028-chunking-and-retrieval.md`.
   - Added evidence files under `evidence/` for corpus, chunk/embed/load, hybrid retrieval, reranking, and Section 5 evaluation.

---

## Required Verification Evidence

### 1. Corpus Acceptance Check

```text
$ python services/retrieval/corpus_check.py
Corpus acceptance check PASSED
```

### 2. Chunker And Retrieval Tests

```text
$ uv run python -m pytest services/retrieval/tests/test_chunker.py services/retrieval/tests/test_retrieve.py -q
.......                                                                  [100%]
7 passed in 1.46s
```

### 3. Unified Store Spot Check

```text
$ psql "$DATABASE_URL" -c "SELECT COUNT(*) AS chunks,
       COUNT(*) FILTER (WHERE length(search_vector::text) > 0) AS with_tsvector,
       COUNT(*) FILTER (WHERE vector_dims(embedding) = 1536) AS with_embedding
FROM retrieval.corpus_chunk;"

 chunks | with_tsvector | with_embedding
--------+---------------+----------------
     31 |            31 |             31
(1 row)
```

### 4. Exact Identifier Query Top Five

```text
query: TPX-RP-001-B
tenant: tenant-alpha-advisory

fused top 5:
1 TPX-PB-007-B-001
2 TPX-RP-001-C-002
3 TPX-RP-001-B-001
4 TPX-PB-009-B-001
5 TPX-RP-005-D-003
```

Correct chunk `TPX-RP-001-B-001` landed in the top five.

Leg-level proof:

```text
keyword: ['TPX-RP-001-B-001', 'TPX-PB-007-B-001', 'TPX-RP-001-C-002']
dense:   ['TPX-PB-009-B-001', 'TPX-PB-007-B-001', 'TPX-RP-001-C-002', 'TPX-RP-005-D-003', 'TPX-RP-005-C-002']
```

### 5. Colloquial Paraphrase Query Top Five

```text
query: what reserve cap applies when one person itemizes planning deductions
tenant: tenant-alpha-advisory

fused top 5:
1 TPX-RP-001-A-000
2 TPX-RP-001-B-001
3 TPX-RP-006-A-000
4 TPX-PB-007-A-000
5 TPX-RP-006-C-002
```

Correct chunk `TPX-RP-001-B-001` landed in the top five.

Leg-level proof:

```text
keyword: []
dense:   ['TPX-RP-001-A-000', 'TPX-RP-001-B-001', 'TPX-RP-006-A-000', 'TPX-PB-007-A-000', 'TPX-RP-006-C-002']
```

### 6. Precision-At-5 Before And After

```text
$ uv run python services/retrieval/eval/precision_at_5.py
mean precision@5 before: 0.417
mean precision@5 after:  0.483
```

### 7. Rerank Cache Proof

```text
$ uv run python -m services.retrieval.rerank
rerank complete: questions=12 api_calls=0 resolved_model_id=gpt-4o-mini-2024-07-18
```

---

## AI-Tool Reflection

We **accepted** the AI suggestion to make retrieval results carry score and full provenance together (`chunk_id`, `tenant_scope`, `source`, `section`, `chunk_offset`, and `content`) instead of returning bare text. That aligned with the deliverable’s citation requirement and kept later generation/audit work from needing to reconstruct source metadata after retrieval.

We **rejected** the AI-default shortcut of treating hybrid retrieval as a weighted sum of raw keyword and dense scores. Keyword rank values and cosine distances are not comparable units, so raw-score fusion would let one leg dominate by numeric range. The implementation instead uses Reciprocal Rank Fusion by rank only at `k=60`.

We also rejected a first rerank-cache shape that still made one API call on a fully cached second run because the resolved model namespace was only learned after the first uncached response. The reranker now discovers the existing resolved-model cache namespace up front, and the second evaluation run reports `api_calls=0`.

---

## PR Routing

- Assignees: self-assigned (`@martinsokorie`).
- Reviewers: request `Isaiah Muli`.

## Checklist

- [x] Corpus acceptance check passes.
- [x] Chunker invariants pass.
- [x] Unified chunk table has text, tenant scope, `tsvector`, and `vector(1536)`.
- [x] Loader is idempotent and cache-backed.
- [x] Hybrid retrieval uses rank-based RRF.
- [x] Exact identifier and paraphrase queries return the correct chunk in top five.
- [x] Tenant isolation is tested.
- [x] Reranking is measured against frozen judgments.
- [x] ADR-0028 records chunking, retrieval, reranking, resolved model id, deferred query transformation, and pooling caveat.
