# ADR-0028: Chunking and retrieval design

## Status

Accepted

## Context

TaxPulse needs a production RAG retriever over a synthetic planning corpus that can answer exact provision-id questions and advisor-style paraphrases while preserving citations. A naive dense-only search can miss literal identifiers, a keyword-only search can miss paraphrases, and free-text answers without chunk provenance cannot be audited.

The retriever operates over `retrieval.corpus_chunk`, a single Postgres table with text, tenant scope, section provenance, `tsvector` keyword search, and `vector(1536)` embeddings.

## Decision

We chunk hierarchically on the corpus documents' H2/H3 section headings. Every chunk carries `source`, `section`, `chunk_offset`, `tenant_scope`, content, and content hash. The configured maximum chunk size is `1800` characters with no overlap. The corpus is intentionally structured into short sections; if a section exceeds that limit, the chunker fails instead of cutting through a threshold table or separating a heading from its body.

Retrieval is hybrid:

- Keyword leg: tenant-scoped query against `search_vector`, with exact synthetic section/chunk identifier matching.
- Dense leg: tenant-scoped cosine search over `embedding vector(1536)`.
- Fusion: Reciprocal Rank Fusion with `k = 60`, summing `1 / (k + rank)` over ranked lists.

Fusion is rank-based because keyword rank scores and cosine distances are not comparable quantities. Adding raw scores would let the leg with the larger numeric range dominate by accident.

Reranking runs as one batched model call per question. The prompt sends the question and a numbered candidate list together, and the model orders candidates by direct usefulness to the question. It does not reuse retrieval scores. Results are cached by question text, ordered candidate ids, candidate content hashes, resolved model id, prompt version, and rerank config.

Measured on the 12-question frozen pool:

- Mean precision@5 before rerank: `0.417`
- Mean precision@5 after rerank: `0.483`
- Resolved rerank model id: `gpt-4o-mini-2024-07-18`

The configured rerank model family is `gpt-4o-mini`, but the resolved id is recorded with the measurement because aliases can be repointed.

## Deferred

Query transformation is deliberately deferred. Rewriting, multi-query expansion, and HyDE would help short or colloquial questions by bridging advisor language to corpus language, but each adds latency and model cost before retrieval. We will add query transformation when the seed set shows recurring paraphrase misses that hybrid retrieval plus reranking cannot recover, or when the corpus grows enough that wording mismatch becomes the dominant failure mode.

## Consequences

Each query now performs keyword retrieval, one query embedding call, dense retrieval, RRF fusion, and one rerank call unless the rerank result is cached. Re-running evaluation over unchanged rankings uses the rerank cache and makes zero rerank API calls.

Changing corpus content requires re-chunking, re-embedding changed chunks, regenerating rankings, and rebuilding the frozen pool. Relevance judgments are tied to the baseline/reranked rankings that produced their pool; changing the retriever invalidates the pool and requires new judgments.
