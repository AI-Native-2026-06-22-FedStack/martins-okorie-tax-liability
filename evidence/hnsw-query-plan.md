# Live PostgreSQL HNSW Index Query Plan Evidence

Verified on 2026-08-28 against live PostgreSQL 17.11 instance with `pgvector 0.8.6` running at `localhost:55433` (database `taxpulse_l`).

---

## 1. Migration & Index Definition

Migration `apps/api/db/migrations/0005_chunk_vector_index.sql` created the HNSW vector index:

```sql
CREATE INDEX IF NOT EXISTS corpus_chunk_embedding_hnsw_idx
ON retrieval.corpus_chunk
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,
    ef_construction = 64
);
```

Verified in PostgreSQL catalog (`pg_indexes`):

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'corpus_chunk' AND indexname = 'corpus_chunk_embedding_hnsw_idx';
```

Output:
```text
indexname                       | indexdef
--------------------------------+---------------------------------------------------------------------------------------------------------------------
corpus_chunk_embedding_hnsw_idx | CREATE INDEX corpus_chunk_embedding_hnsw_idx ON retrieval.corpus_chunk USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')
```

---

## 2. Live Database Query Plan Execution

Executed against `retrieval.corpus_chunk` table (31 seeded chunks, 1536-dimensional `vector` embeddings from `text-embedding-3-small`).

### Executed SQL Query

```sql
SET enable_seqscan = off;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT chunk_id, tenant_scope, source, section, chunk_offset, content
FROM retrieval.corpus_chunk
ORDER BY embedding <=> '[-0.022064209, -0.0146865845, ... 1536 dims]'::vector ASC
LIMIT 10;
```

### Raw Plan Output

```text
Limit  (cost=128.23..132.23 rows=10 width=172) (actual time=0.462..0.580 rows=10 loops=1)
  Output: chunk_id, tenant_scope, source, section, chunk_offset, content, ((embedding <=> '[-0.022064209, ...]'::vector))
  Buffers: shared hit=96
  ->  Index Scan using corpus_chunk_embedding_hnsw_idx on retrieval.corpus_chunk  (cost=128.23..140.62 rows=31 width=172) (actual time=0.461..0.577 rows=10 loops=1)
        Output: chunk_id, tenant_scope, source, section, chunk_offset, content, (embedding <=> '[-0.022064209, ...]'::vector)
        Order By: (corpus_chunk.embedding <=> '[-0.022064209, ...]'::vector)
        Buffers: shared hit=96
Planning:
  Buffers: shared hit=28
Planning Time: 0.155 ms
Execution Time: 0.715 ms
```

### Plan Analysis
- **Node**: `Index Scan using corpus_chunk_embedding_hnsw_idx on retrieval.corpus_chunk`
- **Operator**: Cosine distance operator (`<=>`) matching index operator class `vector_cosine_ops`
- **Shared Buffers Hit**: 96 pages (in-memory cached hit, 0 disk reads)
- **Planning Time**: 0.155 ms
- **Execution Time**: 0.715 ms (consistent sub-millisecond execution)

---

## 3. Automated Live Test Proof

Automated test added in `services/retrieval/tests/test_retrieve.py` (`test_hnsw_index_scan_query_plan`):

```bash
set -a && source .env && [ -f .env.local ] && source .env.local && set +a
uv run pytest -v services/retrieval/tests/test_retrieve.py -k test_hnsw_index_scan_query_plan
```

Test Output:
```text
============================= test session starts ==============================
platform darwin -- Python 3.13.2, pytest-8.4.2, pluggy-1.6.0
rootdir: /Users/martinsokorie/Desktop/martins-okorie-tax-liability
configfile: pyproject.toml
plugins: asyncio-1.2.0, anyio-4.14.2, langsmith-0.11.2
collected 5 items / 4 deselected / 1 selected

services/retrieval/tests/test_retrieve.py::test_hnsw_index_scan_query_plan PASSED [100%]

======================= 1 passed, 4 deselected in 0.81s ========================
```
