import json
from pathlib import Path

import jsonschema
import pytest


@pytest.fixture
def shared_calculation_schema() -> dict:
    # Read the shared schema from the monorepo packages directory
    schema_path = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "packages"
        / "shared-schemas"
        / "calculation.schema.json"
    )
    assert schema_path.exists(), f"Shared schema file missing at {schema_path}"
    return json.loads(schema_path.read_text(encoding="utf-8"))


def test_fastapi_engine_validates_payload_against_shared_schema(
    shared_calculation_schema,
):
    payload = {
        "filing_status": "single",
        "income": 120000.0,
        "deductions": 14600.0,
        "state": "CA",
    }
    # Raises jsonschema.ValidationError on mismatch
    jsonschema.validate(instance=payload, schema=shared_calculation_schema)


def test_fastapi_engine_rejects_negative_income(
    shared_calculation_schema,
):
    payload = {
        "filing_status": "single",
        "income": -500.0,
        "deductions": 14600.0,
        "state": "CA",
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance=payload, schema=shared_calculation_schema)


def test_fastapi_engine_rejects_missing_field(
    shared_calculation_schema,
):
    payload = {
        "income": 120000.0,
        "deductions": 14600.0,
        "state": "CA",
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance=payload, schema=shared_calculation_schema)
