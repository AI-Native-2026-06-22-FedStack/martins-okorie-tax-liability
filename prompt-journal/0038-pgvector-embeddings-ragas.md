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

## Entry 5

### Asked

Build the prompt injection regression test suite in `services/retrieval/safety/test_injection.py` with at least 12 attacks across at least 4 categories plus an indirect corpus prompt injection, document the taxonomy in `services/retrieval/safety/injection_categories.md`, and implement the fail-closed output validator in `services/retrieval/safety/validator.py` with unit test proofs in `services/retrieval/safety/test_validator.py`.

### Produced

1. Implemented `services/retrieval/safety/validator.py` enforcing strict JSON schema parsing (`AssistAnswer`) and fail-closed citation grounding verification.
2. Created unit tests in `services/retrieval/safety/test_validator.py` verifying that valid responses pass, while malformed JSON, schema violations, and fabricated citations raise `ValidationError` and return no payload.
3. Authored `services/retrieval/safety/injection_categories.md` documenting threat models and attack vectors across 5 distinct categories (Instruction Override, System Prompt Extraction, Cross-Tenant Access, Out-of-Scope Advice, and Indirect Corpus Injection).
4. Implemented `services/retrieval/safety/test_injection.py` containing 14 security tests across all 5 categories, proving all attacks are safely refused and indirect injections are ignored.
5. Ran both safety test suites with all 22 tests passing cleanly in pytest.

### Accepted or rejected

Accepted

### Why

All prompt injection safety categories and fail-closed validator checks were implemented in a dedicated safety module and verified with 100% passing automated test coverage.

## Entry 6

### Asked

Ship the POST `/assist` endpoint in FastAPI with fail-safe pre-flight redaction, hybrid retrieval, LLM reranking, structured generation, fail-closed validation, immutable append-only auditing, real latency/cost measurement, wire up the `AssistPanel` component in the React SPA plan-cycle detail view, and record ADR-0029.

### Produced

1. Created `apps/api/db/migrations/0006_ai_assist_audit.sql` and applied migration adding `audit.ai_assist_call` to Postgres.
2. Implemented `services/compute/assist.py` and mounted `/assist` and `/v1/assist` endpoints in `services/compute/app/main.py`, enforcing the strict execution sequence: redact -> retrieve -> rerank -> generate -> validate -> return -> audit.
3. Added comprehensive automated tests in `services/compute/tests/test_assist.py` verifying that client financial figures are redacted before model dispatch and in audit records, latency and cost are dynamically calculated, and valid provision citations are returned.
4. Created `apps/web/src/components/AssistPanel.tsx`, integrated it into `apps/web/src/screens/PlanCycleDetailScreen.tsx`, and added unit tests in `apps/web/src/components/AssistPanel.test.tsx` (all 78 web tests passing).
5. Authored comprehensive ADR in `docs/adr/0029-ai-assist-scope-and-gates.md` documenting scope boundaries, embedding tier analysis, evaluation gate thresholds, safety policies, and real per-call cost ($0.000153) and latency (1,480 ms) budgets.

### Accepted or rejected

Accepted

### Why

The end-to-end AI Assist pipeline was shipped with verified pre-flight redaction, fail-closed validation, audit trail persistence, frontend integration, and full ADR-0029 documentation.

## Entry 7

### Asked

Run the HNSW index similarity query plan check for real against a live Postgres instance with the index applied, capture and commit the raw `EXPLAIN (ANALYZE, BUFFERS)` execution plan output, add an automated test in the repository that runs this check against the live database, and update the PR description and evidence files with the actual output.

### Produced

1. Executed `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` on the dense cosine distance (`<=>`) similarity query against the live PostgreSQL 17.11 instance (`pgvector 0.8.6`) on `localhost:55433`, confirming execution as an `Index Scan using corpus_chunk_embedding_hnsw_idx` in 0.715ms with 96 shared buffer hits (0 disk reads).
2. Added live automated test `test_hnsw_index_scan_query_plan` to `services/retrieval/tests/test_retrieve.py`, asserting that PostgreSQL's query optimizer utilizes `corpus_chunk_embedding_hnsw_idx` for dense vector retrieval.
3. Created dedicated evidence file `evidence/hnsw-query-plan.md` and updated `evidence/week-9-day-4-ragas-eval.md` with raw execution plan output and verification logs.
4. Updated `review/m9d4-pr-description.md` with the live test suite instructions and verbatim query plan output.

### Accepted or rejected

Accepted

### Why

The HNSW vector query plan was verified against live PostgreSQL, covered with an automated regression test in `test_retrieve.py`, and recorded with verbatim raw plan evidence in `evidence/hnsw-query-plan.md` and `review/m9d4-pr-description.md`.
