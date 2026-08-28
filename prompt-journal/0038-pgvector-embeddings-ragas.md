# Prompt Journal: pgvector, Embeddings & RAGAS

## Entry 1

### Asked

Save the Week 9 Day 4 "pgvector, Embeddings & RAGAS" lesson material into `helper/` and start a new prompt journal.

### Produced

1. Saved the formatted Week 9 Day 4 lesson content to `helper/week-9-day-4-pgvector-embeddings-ragas.md`.
2. Initialized `prompt-journal/0038-pgvector-embeddings-ragas.md` as the next sequential prompt journal file.

### Accepted or rejected

Accepted

### Why

The lesson reference material was preserved in `helper/week-9-day-4-pgvector-embeddings-ragas.md` and a new sequential prompt journal was created adhering to the repository's journal standards.

## Entry 2

### Asked

Verify Deliverable 3 retriever presence and seed pairs, install and verify RAGAS / OpenAI imports, check shell / environment secret configuration, verify Module 3 boundary redactor importability, verify FastAPI compute service and React SPA test suites, verify audit schema presence, bootstrap directory layout (`services/retrieval/safety`, `.github/workflows`), and create `thresholds.toml` and `injection_categories.md` starter files.

### Produced

1. Installed `ragas` and its dependencies in the workspace toolchain and verified `uv run python -c "import ragas, openai; print('libraries ok')"` succeeds cleanly.
2. Verified Deliverable 3 retriever modules (`chunker.py`, `embed.py`, `retrieve.py`, `rerank.py`) and 12 judged seed questions in `services/retrieval/eval/seed_pairs.jsonl`.
3. Verified Module 3 boundary redactor (`REDACT_KEYS`, `redact_processor`) from `services.compute.app.logging_config` is importable and all 48 compute tests pass.
4. Verified React SPA test suite with all 75 Vitest tests passing across 19 suites.
5. Created `services/retrieval/eval/thresholds.toml` with the program's quality bar (`faithfulness = 0.85`, `answer_relevancy = 0.85`, `context_precision = 0.80`, `judge_model = "gpt-4o-mini"`) and versioned set filenames.
6. Created `services/retrieval/safety/injection_categories.md` starter structure and created `services/retrieval/safety` and `.github/workflows` directories.
7. Verified `OPENAI_API_KEY` configuration is cleanly loaded from environment / `.env.local` without committing any secrets.

### Accepted or rejected

Accepted

### Why

All Deliverable 4 prerequisites and bootstrap smoke tests were successfully verified, required starter files and directories were provisioned, and all test suites in compute and web passed.

## Entry 3

### Asked

Complete and apply the HNSW index migration (`apps/api/db/migrations/0005_chunk_vector_index.sql`), verify via Postgres query plan (`EXPLAIN ANALYZE`) that the HNSW index is actively used for dense retrieval rather than sequential scans, verify that retrieval on a known question returns its expected chunk, and record the embedding tier comparison (`text-embedding-3-small` vs. `text-embedding-3-large` and the pgvector 2,000-dim index constraint) in `docs/adr/0029-ai-assist-scope-and-gates.md`.

### Produced

1. Created and executed migration `apps/api/db/migrations/0005_chunk_vector_index.sql`, adding an HNSW index on `retrieval.corpus_chunk (embedding vector_cosine_ops)` with `m = 16` and `ef_construction = 64`.
2. Verified via `EXPLAIN (ANALYZE, BUFFERS)` that the query planner performs an `Index Scan using corpus_chunk_embedding_hnsw_idx` on cosine distance (`<=>`) ordering with 0.937ms execution time.
3. Verified that running a known query (`For TPX-RP-001-B, what maximum reserve applies to the single filer threshold table?`) against `retrieve()` returns the expected chunk (`TPX-RP-001-B-001`) as the top result.
4. Authored `docs/adr/0029-ai-assist-scope-and-gates.md` documenting the tier comparison between small (1536-dim, native `vector_cosine_ops`) and large (3072-dim, requires `halfvec(3072)` due to pgvector's hard 2,000-dim limit for standard vector indexes), along with the 100x scaling strategy.

## Entry 4

### Asked

Grow the evaluation set to 20 reviewed examples in `eval_set.jsonl`, create the 5-item `eval_smoke.jsonl` for wiring proofs, implement `test_ragas_gate.py` asserting each of the three metrics (`faithfulness >= 0.85`, `answer_relevancy >= 0.85`, `context_precision >= 0.80`) separately against `thresholds.toml`, prove the gate turns red on a degraded prompt and green on revert, author `.github/workflows/ai-quality.yml` as a required status check, and record evidence in `evidence/week-9-day-4-ragas-eval.md`.

### Produced

1. Created `services/retrieval/eval/eval_set.jsonl` with 20 human-reviewed test pairs and `services/retrieval/eval/eval_smoke.jsonl` with 5 fixed pairs.
2. Implemented `services/retrieval/eval/test_ragas_gate.py` and `services/retrieval/eval/run_eval_set.py` connecting hybrid retrieval, LLM reranking, structured assist answers, and RAGAS evaluation with individual metric assertions.
3. Executed the red/green wiring proof on the smoke set: normal prompt passed (`faithfulness: 1.0000`, `answer_relevancy: 0.8840`, `context_precision: 1.0000`), degraded prompt turned red on faithfulness (`0.7167 < 0.85`), and reverting returned to green.
4. Evaluated the full 20-sample dataset: `faithfulness: 0.8608` (PASS), `answer_relevancy: 0.8520` (PASS), `context_precision: 0.9250` (PASS) against resolved judge `gpt-4o-mini-2024-07-18` at ~$0.0058 per run.
5. Authored `.github/workflows/ai-quality.yml` with Postgres 17 pgvector service container as a required PR check.
6. Documented all findings, thresholds, and operational costs in `evidence/week-9-day-4-ragas-eval.md`.

### Accepted or rejected

Accepted

### Why

The RAGAS evaluation suite and CI quality gate were implemented, individually asserted against all three thresholds, proved reactive to regressions on the smoke suite, and documented with committed evidence.

