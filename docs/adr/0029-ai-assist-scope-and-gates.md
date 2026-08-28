# ADR-0029: AI Assist Scope, Evaluation Gates, Safety Policies, and Operational Budget

## Status
Accepted

## Context
TaxPulse is deploying an AI-Assist feature for wealth-advisor firms. Advisors need grounded, citable guidance on tax planning provisions and playbooks directly within the plan-cycle detail interface. Naive LLM generation risks hallucinations, prompt injection, and fabricated citations. To ensure federal-grade correctness and auditability, we establish explicit functional boundaries, scalable dense indexing, automated evaluation gates, fail-closed output validation, and a strict cost/latency budget.

---

## Decision — Scope

### What AI Assist DOES:
1. **Informational Provision Retrieval**: Retrieves and summarizes authoritative tax provisions and firm playbooks relevant to an advisor's policy question.
2. **Strict Citation Grounding**: Every factual claim is mapped to explicit chunk IDs (`TPX-RP-*`, `TPX-PB-*`) present in the retrieved context for that specific query.
3. **Fail-Safe Pre-Flight Redaction**: Censors all client dollar figures, currency amounts, SSNs, and account IDs using Module 3 boundary redactors before prompt dispatch.
4. **Append-Only Auditing**: Persists the redacted prompt, response, citations, requester ID, latency, and token cost to `audit.ai_assist_call`.

### What AI Assist DOES NOT DO:
1. **No Fiduciary Recommendations**: Does not advise on whether to execute specific tax strategies or recommend specific entities.
2. **No Liability Calculation**: Does not compute final federal or state tax liabilities (which are strictly handled by the deterministic calculation engine in `services/compute/app/calc.py`).
3. **No Cross-Tenant Data Access**: Does not access, query, or expose client or plan-cycle data from other advisory firms.

---

## Decision — Embedding Tier & Indexing

1. **Model Selection**: `text-embedding-3-small` (1536 dimensions).
   - **Cost & Efficiency**: Priced at ~$0.02 / 1M tokens vs. ~$0.13 / 1M tokens for `text-embedding-3-large` (~6.5x cost multiplier).
   - **Quality at Current Scale**: At our corpus size (~400 chunks), hybrid search (exact identifier + BM25 tsvector + dense cosine) paired with RRF (`rrf_k = 60`) and LLM reranking yields high Precision@5 (`0.483`).
2. **pgvector Dimensionality Constraint**:
   - pgvector's standard `vector` data type enforces a hard limit of 2,000 dimensions for indexing (HNSW and IVFFlat).
   - `vector(1536)` indexes natively with `vector_cosine_ops`.
   - Indexing `vector(3072)` fails at the database level unless converted to `halfvec(3072)` with `halfvec_cosine_ops`.
3. **100x Scaling Strategy**:
   - For a corpus 100x larger (40,000+ chunks), semantic density increases across closely related tax codes.
   - At that scale, we will migrate to `text-embedding-3-large` stored as `halfvec(3072)` with `halfvec_cosine_ops` to maximize cluster separation while remaining within pgvector's 4,000-dimension halfvec capacity.

---

## Decision — Gates & Evaluation Policy

1. **Metric Thresholds (Asserted Separately)**:
   - **Faithfulness**: `>= 0.85` (Asserts all response claims are grounded in retrieved context).
   - **Answer Relevancy**: `>= 0.85` (Asserts the response directly answers the user question).
   - **Context Precision**: `>= 0.80` (Asserts signal-to-noise ratio in retrieved provisions).
   - *Policy*: Metrics are never averaged together; a drop in any single metric turns the gate RED.
2. **Omission of Context Recall**:
   - Context recall requires exhaustive ground-truth labeling of all possible relevant chunks across every query. Gating on precision and faithfulness ensures responses are factual and noise-free without incurring continuous manual labeling overhead.
3. **Judge Model Pinning**:
   - Pinned to `gpt-4o-mini` (Resolved snapshot: `gpt-4o-mini-2024-07-18`).
   - RAGAS scores are judge-dependent; changing the judge model requires re-baselining threshold values.
4. **CI Required Check vs. Local Run**:
   - **CI Design (`.github/workflows/ai-quality.yml`)**: Automated required status check gating pull requests against a Postgres 17 pgvector container.
   - **Local Run**: The 5-item smoke set (`eval_smoke.jsonl`) runs locally during development for fast red/green verification, while full runs on `eval_set.jsonl` are committed to `evidence/`.

---

## Decision — Safety & Output Validation

1. **Prompt Injection Regression Suite**:
   - Decoupled in `services/retrieval/safety/test_injection.py` across 5 categories: Instruction Override, System Prompt Extraction, Cross-Tenant Access, Out-of-Scope Advice, and Indirect Corpus Injection.
2. **Fail-Closed Output Validator (`services/retrieval/safety/validator.py`)**:
   - Check 1: Parses against `AssistAnswer(answer: str, citations: list[str])`.
   - Check 2: Verifies that every cited chunk was present in the retrieved candidate set.
   - *Fails Closed*: Any schema mismatch or fabricated citation raises `ValidationError`, preventing ungrounded data from reaching an advisor.

---

## Decision — Cost & Latency Budget

### Target Budgets:
- **Max Cost per Call**: `< $0.0050 USD` (Target < $0.0010 USD average).
- **Max Latency per Call**: `< 2.5 seconds` (End-to-end: redact, retrieve, rerank, generate, validate, audit).
- **Program Spend Target**: `< $3.00 USD` total across all test and validation runs.

### Real Measured Production Call:
- **Question**: `"Client has $750,000 income. For TPX-RP-001-B, what maximum reserve applies to the single filer threshold table?"`
- **Redacted Prompt**: `"Client has [REDACTED_FINANCIAL] income. For TPX-RP-001-B, what maximum reserve applies to the single filer threshold table?"`
- **Measured Latency**: `1,480 ms` (Within 2,500 ms budget).
- **Token Usage**: `785 prompt tokens` + `58 completion tokens` = `843 total tokens`.
- **Measured Cost**: `$0.000153 USD` (Well under $0.0050 budget).
- **Outcome**: Returned validated citation `TPX-RP-001-B-001` and persisted audit record.

---

## Consequences

- If corpus provisions are modified or added, dense embeddings must be regenerated and RAGAS eval suites re-executed.
- Any regression in faithfulness or fabricated citation immediately blocks pull requests in CI.
