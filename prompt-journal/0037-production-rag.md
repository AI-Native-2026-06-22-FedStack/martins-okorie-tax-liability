# Prompt Journal: Production RAG

## Entry 1

### Asked

Save the Week 9 Day 3 "Production RAG: Chunking, Hybrid Retrieval, Reranking & Query Transformation" lesson material into `helper/` and start a new prompt journal.

### Produced

1. Saved the pasted Week 9 Day 3 lesson content to `helper/week-9-day-3-production-rag.md`.
2. Initialized `prompt-journal/0037-production-rag.md` as the next sequential prompt journal file.

### Accepted or rejected

Accepted

### Why

The lesson reference material was preserved in `helper/` and a new sequential prompt journal was created according to the repository's journal conventions.

## Entry 2

### Asked

Verify Section 02 prerequisites for Week 9 Day 3: lesson coverage, pgvector-enabled Postgres, OpenAI API key shell export, OpenAI Python client installation, Deliverable 1-2 pipeline presence, tenant and bracket reference tables, and existing Module 1-8 repo structure.

### Produced

1. Updated `docker-compose.yml` to use the `pgvector/pgvector:pg17` Postgres image.
2. Updated `apps/api/db/migrations/0001_tenant.sql` to create the `vector` extension and expose `public.tenants` as a compatibility view over `public.tenant`.
3. Declared the OpenAI Python client in the root and pipeline Python dependencies, added `services/pipeline` to the uv workspace, synced dependencies, and updated `uv.lock`.
4. Verified local Postgres reports `vector` extension version `0.8.6`.
5. Verified `public.tenant`, `public.tenants`, and `analytics.income_rollup` resolve in the local database.
6. Verified the OpenAI Python client imports from the project virtualenv.
7. Verified compute bracket reference tests passed (3/3) and pipeline boundary/data-quality tests passed (25/25).
8. Captured prerequisite evidence in `evidence/week-9-day-3-prerequisites.md`, noting that `OPENAI_API_KEY` is not exported in this shell and was not written to any file.

### Accepted or rejected

Accepted

### Why

Repo-controlled prerequisites now verify with pgvector, dependency, schema, bracket, and pipeline tests passing, with the only remaining local secret prerequisite safely documented as unset.

## Entry 3

### Asked

Organize root and service environment files so `.env`, `.env.local`, and `.env.example` have clear ownership without overlap, while keeping real secrets local-only and using placeholders in committed examples.

### Produced

1. Updated `.gitignore` so real env files (`.env`, `.env.local`, and service `.env` files) are ignored while all `.env.example` files remain commit-eligible.
2. Removed root `.env.local` from git tracking without deleting the local file.
3. Reworked root `.env.example` for workspace-wide local defaults and RAG/pipeline placeholders, including a blank `OPENAI_API_KEY`.
4. Reworked `apps/api/.env.example` into grouped API-only settings.
5. Added `services/pipeline/.env.example` for pipeline/RAG settings and `services/compute/.env.example` for FastAPI Tax Engine settings.
6. Added ignored root `.env` for non-secret local defaults and reshaped ignored root `.env.local` as private override storage.
7. Removed root `.env.local` from the API Docker Compose service so RAG secrets are not passed into the API container.
8. Verified Docker Compose config parses and API env config tests pass (4/4).

### Accepted or rejected

Accepted

### Why

Environment ownership is now explicit by service, real env files are ignored, committed examples contain placeholders only, and focused API env tests passed.

## Entry 4

### Asked

Verify the Week 9 Day 3 retrieval prep instructions: pgvector Postgres image and extension, version-controlled `data/corpus`, new `services/retrieval` package structure, chunk-table migration expectation, `.cache/` gitignore requirement, bootstrap smoke test, and starter-file readiness.

### Produced

1. Verified `docker-compose.yml` uses `pgvector/pgvector:pg17` and local Postgres is healthy.
2. Verified the local database has `vector` extension version `0.8.6`.
3. Verified `apps/api/db/migrations/0001_tenant.sql` creates the `vector` extension.
4. Added `.cache/` to `.gitignore` for embedding and rerank caches.
5. Created the bootstrap directories `data/corpus`, `services/retrieval`, `services/retrieval/eval`, and `services/retrieval/tests`.
6. Verified `data/exports/` remains ignored and `data/corpus/` is not ignored.
7. Verified the exact OpenAI smoke test fails because `OPENAI_API_KEY` is not exported in this shell, and `DATABASE_URL` is also not exported.
8. Recorded passed and not-yet-complete items in `evidence/week-9-day-3-retrieval-prep.md`.

### Accepted or rejected

Accepted

### Why

The retrieval prep state is now explicitly verified, cache hygiene is fixed, bootstrap directories exist, and remaining blockers are documented before starter implementation begins.

## Entry 5

### Asked

Resolve the retrieval prep smoke-test blockers by making `OPENAI_API_KEY` and `DATABASE_URL` available to the shell used for verification.

### Produced

1. Verified ignored root `.env.local` contains a non-empty `OPENAI_API_KEY` without printing the value.
2. Verified ignored root `.env` contains a non-empty `DATABASE_URL`.
3. Ran the bootstrap smoke test in a shell that exports `.env` and `.env.local`.
4. Confirmed `CREATE EXTENSION IF NOT EXISTS vector;` succeeds, `pg_extension.vector` reports `0.8.6`, and the OpenAI Python client sees `OPENAI_API_KEY`.
5. Updated `evidence/week-9-day-3-retrieval-prep.md` to replace the old env blocker notes with passing smoke-test evidence.

### Accepted or rejected

Accepted

### Why

The exact retrieval bootstrap prerequisites now pass when ignored local env files are loaded into the verification shell, without exposing or committing the OpenAI key.

## Entry 6

### Asked

Complete Task 1 for the production RAG deliverable: generate the synthetic planning corpus against the supplied spec and implement the `services/retrieval/corpus_check.py` acceptance check so it proves the required properties hold.

### Produced

1. Completed `data/corpus/CORPUS-SPEC.md` with the fictional issuer, tenant metadata choices, synthetic identifier scheme, document list, threshold-table section IDs, near-duplicate pairs, and superseded/replacement effective dates.
2. Generated 10 synthetic markdown corpus documents under `data/corpus/`, split into 6 rule provisions and 4 advisory playbooks.
3. Labelled every document as synthetic training material from the Fictional TaxPulse Planning Board and stated that rates and limits are invented.
4. Added tenant metadata to every document front matter.
5. Added stable synthetic section identifiers on every H2/H3 section using `TPX-RP-###-X` and `TPX-PB-###-X`.
6. Included numeric threshold tables, 3 near-duplicate provision groups, and a superseded provision alongside its replacement.
7. Implemented `services/retrieval/corpus_check.py` to verify document count, section IDs, corpus-wide uniqueness, tenant metadata, synthetic labels, threshold tables, near duplicates, and superseded/replacement markers.
8. Recorded acceptance evidence in `evidence/week-9-day-3-corpus-task-1.md`.

### Accepted or rejected

Accepted

### Why

The generated corpus passes `python services/retrieval/corpus_check.py`, and the checker compiles cleanly while enforcing the required retrieval-corpus properties.

## Entry 7

### Asked

Complete Task 2: chunk the corpus with provenance, embed chunks with `text-embedding-3-small`, cache embeddings by content/model/dimensions, load chunks idempotently into Postgres with both `tsvector` and `vector(1536)` columns, and prove the chunking and load invariants.

### Produced

1. Added `services/retrieval/retrieval.toml` with hierarchical chunking config (`max_chars = 1800`, no overlap), embedding settings, retrieval settings, and rerank cache settings.
2. Implemented `services/retrieval/chunker.py` to split on corpus H2/H3 headings and emit chunks carrying `chunk_id`, `tenant_scope`, `source`, `section`, `offset`, `content`, and `content_hash`.
3. Added `services/retrieval/tests/test_chunker.py` covering max chunk length, no orphaned headings, and complete provenance on every chunk.
4. Implemented `services/retrieval/embed.py` to embed uncached chunks with `text-embedding-3-small`, cache by content hash/model/dimensions, and upsert rows into `retrieval.corpus_chunk`.
5. Added and applied `apps/api/db/migrations/0004_corpus_chunk.sql`, creating `retrieval.corpus_chunk` with text, tenant scope, provenance, `tsvector`, and `vector(1536)` columns plus idempotency/search indexes.
6. Verified first load wrote 31 chunks with 31 new embeddings in 1 API call, and second load kept the chunk count unchanged with 0 new embeddings and 0 API calls.
7. Spot-checked `TPX-RP-001-B-001` in Postgres to confirm tenant scope, source, section, offset, content, populated `tsvector`, and 1536-dimensional embedding.
8. Recorded evidence in `evidence/week-9-day-3-chunk-embed-load-task-2.md`.

### Accepted or rejected

Accepted

### Why

Chunker tests passed, the migration loaded into Postgres, both search columns were populated, provenance survived into the table, and a second loader run proved idempotency and cache reuse.

## Entry 8

### Asked

Complete Task 3: implement hybrid retrieval over one chunk table with a tenant-scoped keyword leg, a tenant-scoped dense pgvector leg, Reciprocal Rank Fusion at `k=60`, provenance-bearing results, exact/prose query proof, and tenant isolation tests.

### Produced

1. Added `services/retrieval/retrieve.py` with keyword retrieval over `search_vector`, dense retrieval over `embedding <=> query_embedding`, and RRF fusion by rank.
2. Returned `RetrievedResult` objects carrying fused score plus full provenance (`chunk_id`, `tenant_scope`, `source`, `section`, `chunk_offset`, and `content`).
3. Added `services/retrieval/tests/test_retrieve.py` covering rank-based RRF scoring, provenance on returned results, keyword tenant scoping, and fused retrieval tenant scoping.
4. Verified `uv run python -m pytest services/retrieval/tests/test_chunker.py services/retrieval/tests/test_retrieve.py -q` passes (7/7).
5. Ran the exact identifier query `TPX-RP-001-B` for `tenant-alpha-advisory`; the target chunk `TPX-RP-001-B-001` landed in the fused top five and was ranked first by the keyword leg.
6. Ran the colloquial paraphrase query `what reserve cap applies when one person itemizes planning deductions`; the target chunk `TPX-RP-001-B-001` landed in the fused top five even with no keyword hits, proving dense retrieval contribution.
7. Recorded verification in `evidence/week-9-day-3-hybrid-retrieval-task-3.md`.

### Accepted or rejected

Accepted

### Why

Hybrid retrieval now runs both tenant-scoped legs against the same Postgres chunk table, fuses by RRF ranks rather than raw scores, returns provenance with every result, and passes exact-ID, paraphrase, and tenant-isolation verification.

## Entry 9

### Asked

Complete Task 4: create a 12-question seed set, record before and after top-10 rankings, rerank in one model call per question with caching and resolved model id attribution, freeze and judge pools, implement precision-at-5 scoring, and write ADR-0028.

### Produced

1. Added `services/retrieval/eval/seed_pairs.jsonl` with 12 advisor questions covering exact identifier, colloquial paraphrase, multi-chunk, and near-duplicate cases.
2. Implemented `services/retrieval/rerank.py` to record fused baseline top-10 rankings, rerank each question in one batched `gpt-4o-mini` call, cache by question/candidates/content hashes/resolved model id/prompt version/config, and write `rankings.jsonl` plus `pool.jsonl`.
3. Captured resolved rerank model id `gpt-4o-mini-2024-07-18`.
4. Implemented `services/retrieval/eval/precision_at_5.py` for the chosen JSONL shape.
5. Generated `services/retrieval/eval/rankings.jsonl` and `services/retrieval/eval/pool.jsonl`, each with 12 rows.
6. Measured mean precision@5 before rerank at `0.417` and after rerank at `0.483`.
7. Verified a cached rerank rerun makes `0` rerank API calls.
8. Added `docs/adr/0028-chunking-and-retrieval.md` documenting chunking, hybrid retrieval, RRF, reranking, measured p@5, resolved model id, deferred query transformation, and the frozen-pool caveat.
9. Recorded verification in `evidence/week-9-day-3-rerank-eval-task-4.md`.

### Accepted or rejected

Accepted

### Why

Reranking now has frozen before/after rankings, judged pools, reproducible p@5 measurement, zero-call cache reuse, and ADR coverage tying the measured improvement to the resolved model id.
