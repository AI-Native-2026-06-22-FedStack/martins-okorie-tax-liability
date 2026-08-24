# Week 9 Day 3 Section 5 Evaluation

Verified on 2026-08-24.

## Rubric Mapping

| Criterion | Verification |
|---|---|
| Corpus satisfies documented requirements | `data/corpus/` contains 10 generated corpus documents plus `CORPUS-SPEC.md`; `python services/retrieval/corpus_check.py` passed. |
| Synthetic content is clearly identified | Corpus documents use the synthetic `TPX-RP-###-X` / `TPX-PB-###-X` identifier scheme and front matter with `synthetic: true`, `fictional_issuer: Fictional TaxPulse Planning Board`, and `invented_rates_and_limits: true`. |
| Every chunk retains citation provenance | `services/retrieval/tests/test_chunker.py` verifies max size, no orphan headings, and complete provenance; retrieval rows carry `source`, `section`, and `chunk_offset`. |
| Keyword and vector retrieval use a unified store | `apps/api/db/migrations/0004_corpus_chunk.sql` creates one `retrieval.corpus_chunk` table with `search_vector tsvector` and `embedding vector(1536)`; DB spot check found 31 chunks, 31 populated `tsvector`s, and 31 populated 1536-dim embeddings. |
| Hybrid retrieval is rank-fused and tenant-scoped | `services/retrieval/retrieve.py` fuses by `1.0 / (rrf_k + rank)` at `rrf_k = 60`; tests prove tenant scoping and provenance; Task 3 evidence records exact-id and paraphrase top-five hits. |
| Reranking impact is measured against frozen judgments | `seed_pairs.jsonl`, `rankings.jsonl`, and `pool.jsonl` each have 12 rows; p@5 improved from `0.417` to `0.483`; cached rerank run reports `api_calls=0`; ADR-0028 records decisions, resolved model id, deferred query transformation, and frozen-pool caveat. |

## Commands

```text
python services/retrieval/corpus_check.py
Corpus acceptance check PASSED
```

```text
uv run python -m pytest services/retrieval/tests/test_chunker.py services/retrieval/tests/test_retrieve.py -q
7 passed
```

```text
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS chunks,
       COUNT(*) FILTER (WHERE length(search_vector::text) > 0) AS with_tsvector,
       COUNT(*) FILTER (WHERE vector_dims(embedding) = 1536) AS with_embedding
FROM retrieval.corpus_chunk;"

chunks: 31
with_tsvector: 31
with_embedding: 31
```

```text
uv run python services/retrieval/eval/precision_at_5.py
mean precision@5 before: 0.417
mean precision@5 after:  0.483
```

```text
uv run python -m services.retrieval.rerank
rerank complete: questions=12 api_calls=0 resolved_model_id=gpt-4o-mini-2024-07-18
```

## Files

- `data/corpus/CORPUS-SPEC.md`
- `data/corpus/tpx-*.md`
- `services/retrieval/corpus_check.py`
- `services/retrieval/chunker.py`
- `services/retrieval/embed.py`
- `services/retrieval/retrieve.py`
- `services/retrieval/rerank.py`
- `services/retrieval/eval/seed_pairs.jsonl`
- `services/retrieval/eval/rankings.jsonl`
- `services/retrieval/eval/pool.jsonl`
- `services/retrieval/eval/precision_at_5.py`
- `apps/api/db/migrations/0004_corpus_chunk.sql`
- `docs/adr/0028-chunking-and-retrieval.md`
