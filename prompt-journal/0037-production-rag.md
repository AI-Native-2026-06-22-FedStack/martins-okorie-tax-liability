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
