import json
from pathlib import Path

import jsonschema
from fastapi import HTTPException, status

# Path to single source-of-truth shared contract in monorepo
SHARED_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "packages"
    / "shared-schemas"
    / "calculation.schema.json"
)


def load_shared_schema() -> dict:
    if not SHARED_SCHEMA_PATH.exists():
        raise RuntimeError(
            f"Shared calculation JSON Schema file missing at {SHARED_SCHEMA_PATH}"
        )
    return json.loads(SHARED_SCHEMA_PATH.read_text(encoding="utf-8"))


SHARED_CALCULATION_SCHEMA = load_shared_schema()


def validate_payload_against_shared_schema(payload: dict) -> None:
    """
    Validates live incoming request dictionary against calculation.schema.json.
    Raises HTTPException(422) if validation fails.
    """
    try:
        jsonschema.validate(instance=payload, schema=SHARED_CALCULATION_SCHEMA)
    except jsonschema.ValidationError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Shared JSON Schema boundary validation failure: {err.message}",
        ) from err
