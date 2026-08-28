# Week 9 Day 3 Task 3 Hybrid Retrieval Evidence

Verified on 2026-08-24.

## Implementation

- Added `services/retrieval/retrieve.py`.
- Keyword leg queries `retrieval.corpus_chunk.search_vector` with `websearch_to_tsquery('simple', ...)` and keeps exact synthetic section/chunk identifier matching tenant-scoped.
- Dense leg embeds the incoming question with the configured `text-embedding-3-small` / `1536` dimensions and orders by pgvector cosine distance (`embedding <=> query_embedding`).
- Fusion uses Reciprocal Rank Fusion by rank only:

```text
score = sum(1 / (rrf_k + rank))
rrf_k = 60
```

- Returned results carry score plus full provenance:
  - `chunk_id`
  - `tenant_scope`
  - `source`
  - `section`
  - `chunk_offset`
  - `content`

## Tests

```text
uv run python -m py_compile services/retrieval/retrieve.py services/retrieval/embed.py services/retrieval/chunker.py
uv run python -m pytest services/retrieval/tests/test_chunker.py services/retrieval/tests/test_retrieve.py -q
7 passed
```

The retrieval tests cover:

- RRF score calculation from rank positions.
- Result score and provenance fields.
- Tenant scoping for the keyword leg.
- Tenant scoping for fused retrieval.

## Named Query Proof

Tenant used for both queries: `tenant-alpha-advisory`.

### Exact Identifier Query

```text
query: TPX-RP-001-B
fused top 5:
1 TPX-PB-007-B-001
2 TPX-RP-001-C-002
3 TPX-RP-001-B-001
4 TPX-PB-009-B-001
5 TPX-RP-005-D-003
```

Correct chunk `TPX-RP-001-B-001` landed in the top five.

Leg-level proof:

```text
keyword: ['TPX-RP-001-B-001', 'TPX-PB-007-B-001', 'TPX-RP-001-C-002']
dense:   ['TPX-PB-009-B-001', 'TPX-PB-007-B-001', 'TPX-RP-001-C-002', 'TPX-RP-005-D-003', 'TPX-RP-005-C-002']
```

The exact identifier is carried by the keyword leg.

### Colloquial Paraphrase Query

```text
query: what reserve cap applies when one person itemizes planning deductions
fused top 5:
1 TPX-RP-001-A-000
2 TPX-RP-001-B-001
3 TPX-RP-006-A-000
4 TPX-PB-007-A-000
5 TPX-RP-006-C-002
```

Correct chunk `TPX-RP-001-B-001` landed in the top five.

Leg-level proof:

```text
keyword: []
dense:   ['TPX-RP-001-A-000', 'TPX-RP-001-B-001', 'TPX-RP-006-A-000', 'TPX-PB-007-A-000', 'TPX-RP-006-C-002']
```

The paraphrase is carried by the dense leg.
