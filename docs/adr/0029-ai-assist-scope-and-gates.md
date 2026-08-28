# ADR-0029: AI Assist Scope, Quality/Security Gates, and Embedding Tier Selection

## Status

In Progress / Accepted

## Context

TaxPulse is deploying an AI-Assist feature for wealth-advisor firms. Advisors need grounded, citable guidance on tax planning provisions and playbooks directly within the interface. Naive LLM generation risks hallucinations, prompt injection, and fabricated citations. 

To ensure federal-grade correctness and auditability, we must establish scalable dense indexing, evaluation gates, and security boundaries.

## Decision

### 1. Vector Indexing and Operator Class Selection

We implement an approximate nearest neighbor (ANN) HNSW index over `retrieval.corpus_chunk.embedding`:
- **Index Type**: HNSW (`USING hnsw (embedding vector_cosine_ops)`) with `m = 16` and `ef_construction = 64`.
- **Operator Alignment**: Cosine distance (`<=>`) is utilized in the dense SQL query, directly matching `vector_cosine_ops`. This avoids silent fallback to sequential scans.
- **Migration**: Applied via `apps/api/db/migrations/0005_chunk_vector_index.sql`.

### 2. Embedding Tier Decision: text-embedding-3-small (1536) vs. text-embedding-3-large (3072)

- **Cost Profile**: `text-embedding-3-small` is priced at ~$0.02 per 1M tokens, compared to ~$0.13 per 1M tokens for `text-embedding-3-large` (a ~6.5x cost multiplier).
- **Corpus Size & Quality**: At our current corpus scale (~400 chunks), hybrid retrieval (exact identifier + full-text search `tsvector` + dense cosine) paired with Reciprocal Rank Fusion (`rrf_k = 60`) and LLM reranking provides high Precision@5 (`0.483`). The marginal semantic nuance of 3072 dims does not justify the higher latency and inference cost at this scale.
- **pgvector Hard Dimensionality Constraint**: pgvector's standard `vector` data type enforces a hard limit of 2,000 dimensions for indexing (HNSW and IVFFlat). 
  - Standard `vector(1536)` indexes natively using standard `vector_cosine_ops`.
  - Storing 3072-dimensional embeddings requires using `halfvec(3072)` (16-bit half precision floats, indexable up to 4,000 dimensions) with `halfvec_cosine_ops`. Attempting to build an HNSW index on `vector(3072)` fails at the database level.
- **Scaling Decision (100x Corpus Size)**: For a corpus 100x larger (40,000+ chunks), semantic crowding increases significantly across closely related tax codes. For that scale, we would select `text-embedding-3-large` stored as `halfvec(3072)` with `halfvec_cosine_ops`. The 3072-dim space provides superior cluster separation for subtle regulatory distinctions, while `halfvec` maintains memory efficiency and index build performance within pgvector's 4,000-dimension halfvec capacity.

### 3. Evaluation & CI Gate Architecture

- **RAGAS Quality Gate**: Four distinct metrics localize failures (Faithfulness & Answer Relevancy for generation; Context Precision & Context Recall for retrieval). Thresholds are individually gated:
  - `faithfulness >= 0.85`
  - `answer_relevancy >= 0.85`
  - `context_precision >= 0.80`
- **Judge Pinning**: Calibrated against `gpt-4o-mini`. Changing the judge requires re-baselining thresholds.
- **CI Required Check Rationale**: In production, AI quality tests must run as required status checks on pull requests. During local prototyping, runs are executed on-demand to manage API spend, with output recorded and committed to `evidence/`.

### 4. Security & Safety Defenses

- **Separation of Concerns**: Prompt-injection regression tests are decoupled from quality evaluations.
- **Fail-Closed Output Validation**: The `/assist` endpoint enforces strict JSON Schema matching (`AssistAnswer`) and validates that every cited chunk was present in the retrieved candidate set before returning any output to the client.

## Consequences

- Dense search queries execute via HNSW index scans with sub-millisecond execution latency.
- Indexing remains fully compatible with Postgres standard `vector(1536)` without requiring half-precision conversions.
- Upgrading to large-tier models in the future will require migrating the column type to `halfvec(3072)` and rebuilding the index with `halfvec_cosine_ops`.
