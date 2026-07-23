import json
import pathlib

import structlog


# Load the shared redaction configuration
def load_redact_keys() -> set[str]:
    # Resolve the repository root directory (4 levels up from this file)
    base_dir = pathlib.Path(__file__).resolve().parents[3]
    config_path = base_dir / "shared" / "redaction-config.json"
    try:
        with open(config_path) as f:
            data = json.load(f)
            keys = set()
            for key in data.get("snake_case", []):
                # Strip wildcards (e.g. "*.") to match dict keys directly
                clean_key = key.replace("*.", "")
                keys.add(clean_key)
            return keys
    except Exception:
        # Secure fallback keys
        return {"income", "deductions", "deduction", "password", "token", "authorization", "mfa_secret", "secret"}

REDACT_KEYS = load_redact_keys()

def redact_processor(logger, method_name, event_dict: dict) -> dict:
    """
    Custom structlog processor that recursively redacts declared sensitive keys.
    """
    def redact_dict(d: dict) -> dict:
        for k, v in list(d.items()):
            if k in REDACT_KEYS:
                d[k] = "[REDACTED]"
            elif isinstance(v, dict):
                redact_dict(v)
            elif isinstance(v, list):
                for item in v:
                    if isinstance(item, dict):
                        redact_dict(item)
        return d

    return redact_dict(event_dict)

def configure_logging():
    """
    Configure structlog to emit structured JSON logs.
    Includes merge_contextvars and redact_processor before JSONRenderer.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            redact_processor,  # Censor sensitive fields before serialization
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
