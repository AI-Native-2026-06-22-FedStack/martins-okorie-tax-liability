# Week 9 Day 3 Section 02 Prerequisites

Verified on 2026-08-24.

## Lessons & Environment

- `helper/week-9-day-3-production-rag.md` is present and contains the Week 9 Day 3 lesson material for Topics 1-5:
  - Topic 1: From naive to production RAG.
  - Topic 2: Chunking strategies and provenance.
  - Topic 3: Hybrid retrieval.
  - Topic 4: Re-ranking for precision.
  - Topic 5: Query transformation.
- Existing Module 1-8 repo structure is present: `apps/api`, `services/compute`, `apps/web`, `docs/adr`, `prompt-journal`, and `evidence`.
- Deliverable 1-2 pipeline is present under `services/pipeline` with declared schema, boundary models, quality checks, and tests.

## Runtime Checks

- Postgres compose image updated to `pgvector/pgvector:pg17`.
- Operational migration `apps/api/db/migrations/0001_tenant.sql` now creates both required extensions:
  - `pgcrypto`
  - `vector`
- Local Postgres verification:

```text
select extversion from pg_extension where extname='vector';
extversion: 0.8.6
```

- Reference table verification:

```text
public.tenant: present
public.tenants: present as compatibility view
analytics.income_rollup: present
```

- OpenAI Python client verification:

```text
.venv/bin/python -c "import openai; print('openai import ok')"
openai import ok
```

- `OPENAI_API_KEY` shell export:

```text
test -n "$OPENAI_API_KEY"
exit code: 1
```

The key is not exported in this Codex shell. This is intentionally not committed or written to any file.

## Test Evidence

```text
cd services/compute
../../.venv/bin/python -m pytest tests/test_db.py -q
3 passed
```

```text
cd services/pipeline
DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l \
AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
AWS_DEFAULT_REGION=us-east-1 \
../../.venv/bin/python -m pytest tests/test_pipeline.py -q
25 passed
```
