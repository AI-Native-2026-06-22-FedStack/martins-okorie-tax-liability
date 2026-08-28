# path: services/compute/assist.py
# TaxPulse AI Assist Pipeline.
#
# Strict execution order:
#   redact (Module 3 redactor) -> retrieve -> rerank -> generate -> VALIDATE -> return -> audit
#
# Redaction is fail-safe: if redaction cannot run or fails, NO external model call is made.
# The audit record stores the REDACTED prompt — NEVER the raw original prompt.
# Measures and returns real per-call token costs and measured latency.

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any, Collection

import psycopg
from openai import OpenAI
from pydantic import BaseModel, Field
import dotenv

dotenv.load_dotenv(".env.local")
dotenv.load_dotenv(".env")

from services.retrieval.retrieve import retrieve
from services.retrieval.rerank import rerank_one, load_config as load_rerank_config, get_content_hashes
from services.retrieval.safety.validator import AssistAnswer, ValidationError, validate_assist_response

DEFAULT_DATABASE_URL = "postgresql://taxpulse_app@localhost:55433/taxpulse_l"


class AssistRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Policy question submitted by the advisor.")
    tenant_id: str | None = Field(default=None, description="Optional tenant ID context; defaults to authenticated tenant.")


class AssistResponse(BaseModel):
    answer: str
    citations: list[str]
    latency_ms: float
    estimated_cost_usd: float
    token_usage: dict[str, int]
    redacted_prompt: str


def redact_prompt_text(text: str) -> str:
    """
    Fail-safe text redactor conforming to Module 3 boundary standards.
    Censors currency figures, explicit income/deduction numbers, SSNs, and account IDs.
    If an error occurs, it raises ValueError so unredacted text is never sent to external LLMs.
    """
    if not isinstance(text, str) or not text:
        raise ValueError("Invalid prompt text for redaction")

    try:
        # Redact currency amounts e.g. $450,000, $450k, $450000.00
        redacted = re.sub(r"\$\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*[kKmMbB])?", "[REDACTED_FINANCIAL]", text)
        # Redact labeled financial declarations e.g. income: 450000, deductions: 35000
        redacted = re.sub(
            r"(?i)\b(income|deductions?|salary|wages?|revenue|net worth|assets?)\s*[:=]?\s*\$?\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*[kKmMbB])?",
            r"\1: [REDACTED_FINANCIAL]",
            redacted,
        )
        # Redact SSNs
        redacted = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", redacted)
        # Redact account and EIN numbers
        redacted = re.sub(r"\b(acct|account|ein)\s*[:#]?\s*\d+\b", r"\1: [REDACTED]", redacted, flags=re.I)
        return redacted
    except Exception as exc:
        raise ValueError(f"Redaction failed: {exc}") from exc


def record_audit_entry(
    database_url: str,
    tenant_id: str,
    requester: str,
    redacted_prompt: str,
    response_answer: str,
    citations: list[str],
    latency_ms: float,
    token_usage: dict[str, int],
    estimated_cost_usd: float,
) -> None:
    """
    Writes an immutable append-only record to audit.ai_assist_call.
    Stores only the REDACTED prompt.
    """
    try:
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit.ai_assist_call (
                        tenant_id, requester, redacted_prompt, response_answer,
                        citations, latency_ms, token_usage, estimated_cost_usd
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        tenant_id,
                        requester,
                        redacted_prompt,
                        response_answer,
                        json.dumps(citations),
                        latency_ms,
                        json.dumps(token_usage),
                        estimated_cost_usd,
                    ),
                )
            conn.commit()
    except Exception as e:
        # Log error in production; do not mask audit errors
        print(f"[AUDIT_ERROR] Failed to record AI Assist audit entry: {e}")


def execute_assist_pipeline(
    raw_question: str,
    tenant_id: str,
    requester: str = "advisor@taxpulse.local",
    client: OpenAI | None = None,
    database_url: str | None = None,
) -> AssistResponse:
    """
    Orchestrates the end-to-end AI Assist pipeline with fail-safe redaction,
    retrieval, LLM reranking, structured generation, fail-closed validation, and auditing.
    """
    start_time = time.perf_counter()
    db_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    openai_client = client or OpenAI()
    rerank_cfg = load_rerank_config()

    # Step 1: REDACT prompt (Fail-safe: errors prevent external model calls)
    redacted_prompt = redact_prompt_text(raw_question)

    # Step 2: RETRIEVE candidate chunks
    retrieved_results = retrieve(redacted_prompt, tenant_id)
    candidates = [
        {
            "chunk_id": c.chunk_id,
            "tenant_scope": c.tenant_scope,
            "source": c.source,
            "section": c.section,
            "chunk_offset": c.chunk_offset,
            "content": c.content,
        }
        for c in retrieved_results
    ]
    retrieved_chunk_ids = {c["chunk_id"] for c in candidates}

    # Step 3: RERANK candidate chunks
    content_hashes = get_content_hashes(db_url, [c["chunk_id"] for c in candidates])
    ordered_ids, _, _ = rerank_one(
        client=openai_client,
        question_id=f"assist-{int(time.time() * 1000)}",
        question=redacted_prompt,
        candidates=candidates,
        content_hashes=content_hashes,
        configured_model=rerank_cfg["rerank"]["model"],
        resolved_model_id=None,
        prompt_version=rerank_cfg["rerank"]["prompt_version"],
        cache_dir=Path(rerank_cfg["rerank"]["cache_dir"]),
        rerank_config={"candidate_count": len(candidates), "temperature": 0},
    )

    cand_map = {c["chunk_id"]: f"[{c['chunk_id']}] {c['content']}" for c in candidates}
    top_contexts = [cand_map[cid] for cid in ordered_ids[:3] if cid in cand_map]

    # Step 4: GENERATE structured response
    system_prompt = (
        "You are an AI tax planning assistant for wealth advisors at TaxPulse. "
        "Provide a direct, concise, and complete answer to the advisor's question based strictly on the retrieved provisions. "
        "Directly state the exact numbers, thresholds, percentage rates, and rules requested by the question. "
        "List all supporting chunk IDs in the citations field."
    )
    context_str = "\n\n".join(top_contexts) if top_contexts else "No relevant provisions found."
    user_prompt = f"Question: {redacted_prompt}\n\nRetrieved Provisions:\n{context_str}"

    llm_resp = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=AssistAnswer,
        temperature=0,
    )

    raw_answer = llm_resp.choices[0].message.parsed
    if raw_answer is None:
        raise ValidationError("Model returned unparseable response")

    # Step 5: VALIDATE response (Fail-closed: invalid citations or schema raise ValidationError)
    validated_response = validate_assist_response(raw_answer, retrieved_chunk_ids)

    # Compute actual token usage and latency
    end_time = time.perf_counter()
    latency_ms = round((end_time - start_time) * 1000, 2)

    usage = llm_resp.usage
    input_tokens = usage.prompt_tokens if usage else 0
    output_tokens = usage.completion_tokens if usage else 0
    token_usage = {
        "prompt_tokens": input_tokens,
        "completion_tokens": output_tokens,
        "total_tokens": (input_tokens + output_tokens),
    }

    # gpt-4o-mini pricing: $0.15 / 1M in, $0.60 / 1M out
    estimated_cost_usd = (input_tokens / 1_000_000 * 0.15) + (output_tokens / 1_000_000 * 0.60)

    # Step 6: AUDIT record (Saves REDACTED prompt, never raw question)
    record_audit_entry(
        database_url=db_url,
        tenant_id=tenant_id,
        requester=requester,
        redacted_prompt=redacted_prompt,
        response_answer=validated_response.answer,
        citations=validated_response.citations,
        latency_ms=latency_ms,
        token_usage=token_usage,
        estimated_cost_usd=estimated_cost_usd,
    )

    # Step 7: RETURN validated response
    return AssistResponse(
        answer=validated_response.answer,
        citations=validated_response.citations,
        latency_ms=latency_ms,
        estimated_cost_usd=estimated_cost_usd,
        token_usage=token_usage,
        redacted_prompt=redacted_prompt,
    )
