# Week 9 Day 3 Retrieval Prep Verification

Verified on 2026-08-24.

## Passed

- `docker-compose.yml` uses the pgvector-enabled Postgres image:

```text
pgvector/pgvector:pg17
```

- Local Postgres is running healthy through Docker Compose.
- The `vector` extension is installed in the local database:

```text
select extversion from pg_extension where extname='vector';
extversion: 0.8.6
```

- `apps/api/db/migrations/0001_tenant.sql` includes:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- `.cache/` is now ignored by git for local embedding and rerank caches.
- `data/exports/` remains ignored as generated Deliverable 1 output.
- `data/corpus/` is not ignored, so corpus documents can be version-controlled when added.
- Bootstrap directories exist:

```text
data/corpus
services/retrieval
services/retrieval/eval
services/retrieval/tests
```

## Environment Smoke Test

- `OPENAI_API_KEY` is present in ignored local env, loaded into the smoke-test shell, and verified without printing the value.
- `DATABASE_URL` is present in ignored local env, loaded into the smoke-test shell, and verified against local Postgres.

```text
set -a; . ./.env; . ./.env.local; set +a
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "$DATABASE_URL" -c "select extversion from pg_extension where extname='vector';"
uv run python -c "import os, openai; assert os.environ['OPENAI_API_KEY']; print('key present')"

NOTICE: extension "vector" already exists, skipping
CREATE EXTENSION
extversion: 0.8.6
key present
```

## Not Yet Complete

- `services/retrieval/` has the directory structure but no package files yet.
- `services/retrieval/retrieval.toml` has not been added yet.
- `data/corpus/` is empty; `CORPUS-SPEC.md` and the 10-12 synthetic corpus documents still need to be created.
- The corpus chunk table migration starter is not present yet.
- `docs/adr/0028-chunking-and-retrieval.md` is not present yet.
