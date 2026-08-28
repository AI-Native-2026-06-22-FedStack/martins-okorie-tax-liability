# path: services/retrieval/safety/validator.py
# Fail-closed output validator for TaxPulse AI Assist.
#
# Two blocking checks before any response reaches an advisor:
#   1. The response strictly parses against the JSON answer contract (AssistAnswer).
#   2. EVERY citation refers to a chunk ID that was ACTUALLY retrieved for THIS query.
#
# Fails CLOSED: Any violation raises ValidationError immediately.
# No response payload is returned on violation, preventing fabricated citations
# from reaching advisors or clients.

from __future__ import annotations

import json
from typing import Any, Collection
from pydantic import BaseModel, Field, ValidationError as PydanticValidationError


class ValidationError(Exception):
    """Raised when an assistant response fails output contract or citation grounding validation."""
    pass


class AssistAnswer(BaseModel):
    answer: str = Field(
        ...,
        min_length=1,
        description="Direct, grounded answer to the advisor's question.",
    )
    citations: list[str] = Field(
        default_factory=list,
        description="Chunk IDs of the provisions directly supporting this answer.",
    )


def validate_assist_response(
    raw_response: str | dict[str, Any] | BaseModel,
    retrieved_chunk_ids: Collection[str],
) -> AssistAnswer:
    """
    Validates the AI assistant response against schema and citation grounding.

    Args:
        raw_response: Raw JSON string, dictionary, or Pydantic model from LLM generation.
        retrieved_chunk_ids: Set/collection of chunk IDs returned by retriever for this query.

    Returns:
        Validated AssistAnswer model.

    Raises:
        ValidationError: If JSON is invalid, schema is violated, or any citation is fabricated.
    """
    # Check 1: Parse against JSON answer contract
    parsed_answer: AssistAnswer
    if isinstance(raw_response, AssistAnswer):
        parsed_answer = raw_response
    elif isinstance(raw_response, BaseModel):
        try:
            parsed_answer = AssistAnswer.model_validate(raw_response.model_dump())
        except PydanticValidationError as e:
            raise ValidationError(f"Response schema validation failed: {e}") from e
    elif isinstance(raw_response, dict):
        try:
            parsed_answer = AssistAnswer.model_validate(raw_response)
        except PydanticValidationError as e:
            raise ValidationError(f"Response schema validation failed: {e}") from e
    elif isinstance(raw_response, str):
        cleaned = raw_response.strip()
        # Handle markdown codeblock wrapper if present
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            payload = json.loads(cleaned)
            parsed_answer = AssistAnswer.model_validate(payload)
        except (json.JSONDecodeError, PydanticValidationError) as e:
            raise ValidationError(f"Invalid JSON response or schema violation: {e}") from e
    else:
        raise ValidationError(f"Unsupported response type: {type(raw_response).__name__}")

    # Check 2: Verify every citation was actually retrieved for THIS query
    valid_ids = set(retrieved_chunk_ids)
    fabricated_citations: list[str] = []

    for citation in parsed_answer.citations:
        if citation not in valid_ids:
            fabricated_citations.append(citation)

    if fabricated_citations:
        raise ValidationError(
            f"Fail-closed: Fabricated citation(s) detected not in retrieved context: {fabricated_citations}. "
            f"Valid retrieved chunks for query: {sorted(valid_ids)}"
        )

    return parsed_answer
