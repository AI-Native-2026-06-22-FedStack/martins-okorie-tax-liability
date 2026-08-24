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
