import json
from pathlib import Path


def load_schema(filename: str) -> dict:
    schema_path = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "packages"
        / "shared-schemas"
        / filename
    )
    assert schema_path.exists(), f"Schema file missing at {schema_path}"
    return json.loads(schema_path.read_text(encoding="utf-8"))


def detect_schema_drift(prev_schema: dict, curr_schema: dict) -> tuple[list[str], list[str]]:
    breaking_changes: list[str] = []
    minor_changes: list[str] = []

    prev_required = set(prev_schema.get("required", []))
    curr_required = set(curr_schema.get("required", []))

    prev_props = set(prev_schema.get("properties", {}).keys())
    curr_props = set(curr_schema.get("properties", {}).keys())

    # 1. Newly required fields (breaking change)
    for field in curr_required - prev_required:
        breaking_changes.append(f"Newly required field added: {field}")

    # 2. Removed properties (breaking change)
    for field in prev_props - curr_props:
        breaking_changes.append(f"Property removed: {field}")

    # 3. Added optional properties (minor change)
    for field in curr_props - prev_props:
        if field not in curr_required:
            minor_changes.append(f"Optional property added: {field}")

    return breaking_changes, minor_changes


def check_semver_compatibility(prev_ver: str, curr_ver: str, breaking_changes: list[str]) -> bool:
    prev_major = int(prev_ver.split(".")[0])
    curr_major = int(curr_ver.split(".")[0])

    if breaking_changes and curr_major <= prev_major:
        return False
    return True


def test_contract_drift_current_vs_snapshot_passes():
    prev_schema = load_schema("previous-calculation.schema.json")
    curr_schema = load_schema("calculation.schema.json")

    breaking_changes, _ = detect_schema_drift(prev_schema, curr_schema)
    assert check_semver_compatibility("1.0.0", "1.0.0", breaking_changes) is True


def test_contract_drift_breaking_change_without_major_bump_fails():
    prev_schema = load_schema("previous-calculation.schema.json")
    modified_schema = dict(prev_schema)
    modified_schema["required"] = prev_schema["required"] + ["new_required_field"]
    modified_schema["properties"] = {
        **prev_schema["properties"],
        "new_required_field": {"type": "string"},
    }

    breaking_changes, _ = detect_schema_drift(prev_schema, modified_schema)
    assert len(breaking_changes) > 0
    # Version 1.1.0 (minor bump) on breaking change must fail
    assert check_semver_compatibility("1.0.0", "1.1.0", breaking_changes) is False


def test_contract_drift_breaking_change_with_major_bump_passes():
    prev_schema = load_schema("previous-calculation.schema.json")
    modified_schema = dict(prev_schema)
    modified_schema["required"] = prev_schema["required"] + ["new_required_field"]
    modified_schema["properties"] = {
        **prev_schema["properties"],
        "new_required_field": {"type": "string"},
    }

    breaking_changes, _ = detect_schema_drift(prev_schema, modified_schema)
    # Version 2.0.0 (major bump) on breaking change passes
    assert check_semver_compatibility("1.0.0", "2.0.0", breaking_changes) is True
