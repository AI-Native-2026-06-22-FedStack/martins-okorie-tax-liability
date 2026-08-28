# Week 9 Day 3 Task 2 Chunk / Embed / Load Evidence

Verified on 2026-08-24.

## Decisions

- Chunking strategy: hierarchical, split on each document's H2/H3 section headings.
- Maximum chunk size: `1800` characters.
- Overlap: `0`.
- Justification: the corpus is intentionally structured into short titled provisions and playbook sections; if a heading-defined section exceeds `1800` characters, the chunker fails loudly instead of cutting through threshold tables or orphaning headings.
- Embedding model: `text-embedding-3-small`.
- Embedding dimensions: `1536`.
- Cache key: `hash(chunk content, model, dimensions)`, stored under `.cache/embeddings`.
- Loader idempotency: stable `chunk_id` primary key plus `content_hash`; unchanged rows are skipped before embedding, cached vectors are reused, and `ON CONFLICT` updates only changed rows.

## Migration

Applied `apps/api/db/migrations/0004_corpus_chunk.sql`.

The migration creates:

- `retrieval.corpus_chunk`
- text content and provenance columns
- `tenant_scope`
- `search_vector tsvector`
- `embedding vector(1536)`
- primary key and uniqueness/indexes for idempotent loading and tenant-scoped keyword search

## Commands

```text
python -m py_compile services/retrieval/chunker.py services/retrieval/embed.py services/retrieval/corpus_check.py
```

```text
python -m pytest services/retrieval/tests/test_chunker.py -q
3 passed
```

```text
python services/retrieval/corpus_check.py
Corpus acceptance check PASSED
```

```text
psql "$DATABASE_URL" -f apps/api/db/migrations/0004_corpus_chunk.sql
CREATE EXTENSION
CREATE SCHEMA
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

```text
uv run python services/retrieval/embed.py
retrieval load complete: chunks=31 loaded=31 new_embeddings=31 api_calls=1
```

```text
uv run python services/retrieval/embed.py
retrieval load complete: chunks=31 loaded=31 new_embeddings=0 api_calls=0
```

## Database Spot Checks

```text
SELECT COUNT(*) AS chunk_count, COUNT(DISTINCT chunk_id) AS distinct_chunk_ids
FROM retrieval.corpus_chunk;

chunk_count: 31
distinct_chunk_ids: 31
```

```text
SELECT chunk_id, tenant_scope, source, section, chunk_offset,
       length(content) AS content_chars,
       length(search_vector::text) > 0 AS has_tsvector,
       vector_dims(embedding) AS embedding_dims
FROM retrieval.corpus_chunk
WHERE section = 'TPX-RP-001-B'
LIMIT 1;

chunk_id: TPX-RP-001-B-001
tenant_scope: tenant-alpha-advisory
source: data/corpus/tpx-rp-001-single-deduction-reserve.md
section: TPX-RP-001-B
chunk_offset: 1
content_chars: 292
has_tsvector: true
embedding_dims: 1536
```

```text
find .cache/embeddings -type f | wc -l
31
```

The `.cache/` directory is gitignored and is not part of the repository.
