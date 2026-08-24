# Week 9 Day 3 Task 4 Rerank Evaluation Evidence

Verified on 2026-08-24.

## Seed Set

- `services/retrieval/eval/seed_pairs.jsonl` contains 12 advisor questions.
- Each question has:
  - `question_id`
  - `tenant_scope`
  - `question`
  - `expected_chunk_id`
  - `relevant_chunk_ids`
- The seed set includes:
  - an exact identifier query;
  - a colloquial paraphrase;
  - questions with multiple relevant chunks;
  - near-duplicate provision cases.

## Rerank Design

- Reranker: `services/retrieval/rerank.py`.
- One batched model call per question on first uncached run.
- Prompt sends the question and numbered candidate list together.
- Candidates are scored against the question, not retrieval scores.
- Configured model family: `gpt-4o-mini`.
- Resolved model id captured from the API response: `gpt-4o-mini-2024-07-18`.
- Cache key includes:
  - question text;
  - ordered candidate ids;
  - candidate content hashes;
  - resolved model id;
  - prompt version;
  - rerank config.

## Generated Evaluation Files

```text
12 services/retrieval/eval/seed_pairs.jsonl
12 services/retrieval/eval/rankings.jsonl
12 services/retrieval/eval/pool.jsonl
```

- `rankings.jsonl` contains before and after top-10 rankings for each question.
- `pool.jsonl` contains the frozen judged pool for each question.
- Every ranking row records `resolved_model_id`.

## Commands

First uncached rerank run:

```text
uv run python -m services.retrieval.rerank
rerank complete: questions=12 api_calls=12 resolved_model_id=gpt-4o-mini-2024-07-18
```

Cached rerank run:

```text
uv run python -m services.retrieval.rerank
rerank complete: questions=12 api_calls=0 resolved_model_id=gpt-4o-mini-2024-07-18
```

Precision-at-5:

```text
uv run python services/retrieval/eval/precision_at_5.py
mean precision@5 before: 0.417
mean precision@5 after:  0.483
```

Validation:

```text
uv run python -m py_compile services/retrieval/rerank.py services/retrieval/retrieve.py services/retrieval/eval/precision_at_5.py
uv run python -m pytest services/retrieval/tests/test_chunker.py services/retrieval/tests/test_retrieve.py -q
7 passed
```

## ADR

`docs/adr/0028-chunking-and-retrieval.md` records the chunking, hybrid retrieval, RRF, reranking, measured p@5, resolved model id, query-transformation deferral, and frozen-pool caveat.
