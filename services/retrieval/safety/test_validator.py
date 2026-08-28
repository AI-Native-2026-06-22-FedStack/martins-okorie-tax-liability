# path: services/retrieval/safety/test_validator.py
# Unit tests proving that the output validator fails closed on schema and citation violations.

import pytest
from pydantic import BaseModel
from services.retrieval.safety.validator import AssistAnswer, ValidationError, validate_assist_response


def test_valid_response_with_valid_citations_passes() -> None:
    raw = {
        "answer": "Under TPX-RP-001-B, the maximum reserve for single filers is $18,400.",
        "citations": ["TPX-RP-001-B-001"],
    }
    retrieved_chunk_ids = {"TPX-RP-001-B-001", "TPX-RP-001-C-002"}
    result = validate_assist_response(raw, retrieved_chunk_ids)

    assert isinstance(result, AssistAnswer)
    assert result.answer == raw["answer"]
    assert result.citations == ["TPX-RP-001-B-001"]


def test_valid_json_string_passes() -> None:
    raw_json = '{"answer": "Single filer threshold floor is $4,200.", "citations": ["TPX-RP-001-B-001"]}'
    retrieved = {"TPX-RP-001-B-001"}
    result = validate_assist_response(raw_json, retrieved)
    assert result.answer == "Single filer threshold floor is $4,200."
    assert result.citations == ["TPX-RP-001-B-001"]


def test_markdown_wrapped_json_passes() -> None:
    raw_markdown = '```json\n{"answer": "Floor is $4,200.", "citations": ["TPX-RP-001-B-001"]}\n```'
    retrieved = {"TPX-RP-001-B-001"}
    result = validate_assist_response(raw_markdown, retrieved)
    assert result.answer == "Floor is $4,200."


def test_fabricated_citation_fails_closed() -> None:
    """A response that cites a chunk not in retrieved context must be rejected."""
    raw = {
        "answer": "Fabricated provision claim with plausible chunk id.",
        "citations": ["TPX-RP-999-Z-999"],  # Not retrieved!
    }
    retrieved = {"TPX-RP-001-B-001", "TPX-RP-001-C-002"}

    with pytest.raises(ValidationError) as excinfo:
        validate_assist_response(raw, retrieved)

    assert "Fabricated citation(s) detected" in str(excinfo.value)
    assert "TPX-RP-999-Z-999" in str(excinfo.value)


def test_partially_fabricated_citations_fails_closed() -> None:
    """Even if one citation is valid, any fabricated citation causes immediate rejection."""
    raw = {
        "answer": "Mixed citations claim.",
        "citations": ["TPX-RP-001-B-001", "TPX-FABRICATED-002"],
    }
    retrieved = {"TPX-RP-001-B-001"}

    with pytest.raises(ValidationError) as excinfo:
        validate_assist_response(raw, retrieved)

    assert "TPX-FABRICATED-002" in str(excinfo.value)


def test_malformed_json_fails_closed() -> None:
    raw_invalid = "This is not json at all."
    retrieved = {"TPX-RP-001-B-001"}

    with pytest.raises(ValidationError) as excinfo:
        validate_assist_response(raw_invalid, retrieved)

    assert "Invalid JSON response or schema violation" in str(excinfo.value)


def test_missing_required_answer_field_fails_closed() -> None:
    raw_missing = {"citations": ["TPX-RP-001-B-001"]}  # missing 'answer'
    retrieved = {"TPX-RP-001-B-001"}

    with pytest.raises(ValidationError) as excinfo:
        validate_assist_response(raw_missing, retrieved)

    assert "schema validation failed" in str(excinfo.value).lower()


def test_empty_retrieved_set_with_citations_fails_closed() -> None:
    raw = {
        "answer": "Answer citing ungrounded provision.",
        "citations": ["TPX-RP-001-B-001"],
    }
    retrieved: set[str] = set()  # No chunks retrieved

    with pytest.raises(ValidationError) as excinfo:
        validate_assist_response(raw, retrieved)

    assert "Fabricated citation(s) detected" in str(excinfo.value)
