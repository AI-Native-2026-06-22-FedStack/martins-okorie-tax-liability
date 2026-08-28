# PR: Week 9 Day 4 — pgvector, Embeddings & RAGAS

## Summary

This PR delivers the Week 9 Day 4 production AI Assist feature, automated RAGAS evaluation gates, and prompt-injection security defenses for TaxPulse:

1. **HNSW Vector Index & Tier Analysis**:
   - Added migration `apps/api/db/migrations/0005_chunk_vector_index.sql` creating `retrieval.corpus_chunk_embedding_hnsw_idx` using `hnsw (embedding vector_cosine_ops)` with `m = 16, ef_construction = 64`.
   - Verified against a live PostgreSQL 17.11 instance (`pgvector 0.8.6`) via `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` that dense queries execute as an `Index Scan using corpus_chunk_embedding_hnsw_idx` on cosine distance (`<=>`) in 0.715ms (0 disk reads, shared hit=96).
   - Added live database automated test `test_hnsw_index_scan_query_plan` in `services/retrieval/tests/test_retrieve.py` and committed raw plan evidence to `evidence/hnsw-query-plan.md` and `evidence/week-9-day-4-ragas-eval.md`.
   - Documented the embedding tier trade-offs (`text-embedding-3-small` standard 1536-dim vector vs. `text-embedding-3-large` 3072-dim `halfvec` under pgvector's hard 2,000-dim vector index ceiling) in ADR-0029.

2. **RAGAS Quality Gate & Smoke Proof**:
   - Authored `services/retrieval/eval/eval_set.jsonl` (20 human-reviewed test pairs) and `services/retrieval/eval/eval_smoke.jsonl` (5 fixed smoke pairs).
   - Configured `services/retrieval/eval/thresholds.toml` gating on `faithfulness >= 0.85`, `answer_relevancy >= 0.85`, and `context_precision >= 0.80` individually against pinned judge `gpt-4o-mini` (resolved: `gpt-4o-mini-2024-07-18`).
   - Proved the quality gate detects real regressions: a degraded prompt on the 5-sample smoke suite turns the gate **RED** on faithfulness (`0.7167 < 0.85`), and reverting returns the suite to **GREEN** (`1.0000`).
   - Authored `.github/workflows/ai-quality.yml` running in CI with a Postgres 17 pgvector service container.

3. **Prompt Injection Safety Suite & Fail-Closed Validator**:
   - Documented taxonomy in `services/retrieval/safety/injection_categories.md` across 5 distinct categories (Instruction Override, System Prompt Extraction, Cross-Tenant Access, Out-of-Scope Advice, and Indirect Corpus Injection).
   - Implemented `services/retrieval/safety/test_injection.py` with 14 automated tests proving all attacks are refused and indirect corpus injections are ignored.
   - Implemented `services/retrieval/safety/validator.py` with unit tests in `services/retrieval/safety/test_validator.py`, guaranteeing fail-closed rejection of invalid schemas and ungrounded/fabricated citations.

4. **Production `/assist` Endpoint & Audit Trail**:
   - Built `services/compute/assist.py` mounting `POST /assist` and `/v1/assist` in `services/compute/app/main.py`.
   - Strictly enforces the pipeline order:
     $$\text{Redact (Fail-Safe)} \longrightarrow \text{Retrieve} \longrightarrow \text{Rerank} \longrightarrow \text{Generate} \longrightarrow \text{Validate (Fail-Closed)} \longrightarrow \text{Return} \longrightarrow \text{Audit}$$
   - Applied migration `apps/api/db/migrations/0006_ai_assist_audit.sql` recording append-only audit entries to `audit.ai_assist_call` storing the REDACTED prompt, answer, citations, measured latency, and token cost.

5. **SPA Assist Panel & ADR-0029**:
   - Built `apps/web/src/components/AssistPanel.tsx` integrated into `apps/web/src/screens/PlanCycleDetailScreen.tsx` (all 78 web tests passing).
   - Recorded ADR-0029 in `docs/adr/0029-ai-assist-scope-and-gates.md` and committed evaluation and query plan evidence in `evidence/hnsw-query-plan.md` and `evidence/week-9-day-4-ragas-eval.md`.

---

## Related ADR

ADR: [ADR-0029: AI Assist Scope, Evaluation Gates, Safety Policies, and Operational Budget](docs/adr/0029-ai-assist-scope-and-gates.md)

---

## Testing

### Automated Test Runs
1. **Live Retrieval & HNSW Query Plan Test Suite (5/5 passing)**:
   ```bash
   set -a && source .env && [ -f .env.local ] && source .env.local && set +a
   uv run pytest -v services/retrieval/tests/test_retrieve.py
   ```
   **Live PostgreSQL 17 + pgvector 0.8.6 `EXPLAIN (ANALYZE, BUFFERS)` Raw Query Plan**:
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

2. **Safety & Assist Pipeline Test Suite (26/26 passing)**:
   ```bash
   PYTHONPATH=.:services/compute uv run pytest -v services/compute/tests/test_assist.py services/retrieval/safety/
   ```
3. **React SPA Vitest Suite (78/78 passing across 20 test files)**:
   ```bash
   npm test -- --run (in apps/web)
   ```
4. **RAGAS Evaluation Gate (20-sample eval set)**:
   ```bash
   PYTHONPATH=. uv run python services/retrieval/eval/run_eval_set.py
   # Results:
   #   - faithfulness: 0.8608 >= 0.85 (PASS)
   #   - answer_relevancy: 0.8520 >= 0.85 (PASS)
   #   - context_precision: 0.9250 >= 0.80 (PASS)
   ```


---

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
AI Review of Week 9 Day 4 AI Assist Pipeline:
- Verified that HNSW vector index migration 0005_chunk_vector_index.sql is created and actively referenced in query execution plans.
- Confirmed evaluation suite in services/retrieval/eval/test_ragas_gate.py asserts faithfulness, answer_relevancy, and context_precision separately against thresholds.toml.
- Verified prompt injection regression test suite in services/retrieval/safety/test_injection.py covers distinct attack mechanisms across 5 categories, including an indirect prompt injection planted inside a corpus chunk.
- Verified fail-closed validator in services/retrieval/safety/validator.py raises ValidationError on ungrounded citations and prevents invalid payloads from returning to the caller.
- Verified /assist endpoint executes pre-flight text redaction prior to model invocation and stores only the redacted prompt in audit.ai_assist_call.
- Verified AssistPanel.tsx component renders citations visibly on the plan-cycle detail screen.
```

Paste the "what it missed" note as a quote or code block:

```text
The automated AI reviewer initially suggested combining the prompt-injection security tests with the RAGAS evaluation suite to compute a unified composite quality/safety score. A human engineer and the AI safety checklist catch that mixing security and quality metrics allows critical injection vulnerabilities to be hidden by a high average generation score; security tests must remain in an isolated, independently gated module (services/retrieval/safety/).
```

---

## AI-tool reflection

During implementation, Codex suggested using a single fail-safe try-except block around the entire `/assist` pipeline that logged a warning on validation error and returned the unvalidated model output to avoid user disruption; this suggestion was **rejected** because returning ungrounded or fabricated provision citations to wealth advisors violates the fiduciary requirement to fail closed on unverified legal claims. Conversely, Codex's suggestion to enforce strict pre-flight regex sanitization (`[REDACTED_FINANCIAL]`) before dispatching prompts to OpenAI and persisting only the redacted prompt to `audit.ai_assist_call` was **accepted**, ensuring client financial figures are never exposed over external APIs or stored unredacted in permanent audit logs.

---

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

---

## AI code-review checklist

- [x] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions gated by role and current stage.
- [x] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

---

## Deliverables checklist

- [x] Summary explains what changed.
- [x] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [x] Testing lists only checks or verification actually performed.
- [x] AI code-review checklist is completed.
- [x] AI review output is pasted above as a quote or code block.
- [x] "What it missed" note is pasted above as a quote or code block.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers.
