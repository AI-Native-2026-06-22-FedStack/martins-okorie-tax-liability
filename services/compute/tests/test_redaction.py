import io
import json
import sys

import structlog
from app.logging_config import configure_logging


def test_python_redactor_success_path():
    # Capture print output from structlog PrintLoggerFactory
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        configure_logging()
        logger = structlog.get_logger()
        
        logger.info(
            "Filing processed",
            income=150000.0,
            deductions=35000.0,
            authorization="Bearer token-123",
            token="raw-token-456",
            message="all checks passed"
        )
        
        output = sys.stdout.getvalue()
        assert output
        log_obj = json.loads(output.strip())
        
        assert log_obj["income"] == "[REDACTED]"
        assert log_obj["deductions"] == "[REDACTED]"
        assert log_obj["authorization"] == "[REDACTED]"
        assert log_obj["token"] == "[REDACTED]"
        assert log_obj["message"] == "all checks passed"
    finally:
        sys.stdout = old_stdout

def test_python_redactor_nested_fields():
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        configure_logging()
        logger = structlog.get_logger()
        
        logger.info(
            "Nested cycle event",
            cycle={
                "id": "abc-456",
                "income": 200000.0,
                "deductions": 50000.0,
                "secret": "nested-secret"
            }
        )
        
        output = sys.stdout.getvalue()
        log_obj = json.loads(output.strip())
        
        assert log_obj["cycle"]["income"] == "[REDACTED]"
        assert log_obj["cycle"]["deductions"] == "[REDACTED]"
        assert log_obj["cycle"]["secret"] == "[REDACTED]"
        assert log_obj["cycle"]["id"] == "abc-456"
    finally:
        sys.stdout = old_stdout

def test_python_redactor_error_path():
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        configure_logging()
        logger = structlog.get_logger()
        
        logger.error(
            "Failed computation",
            error="division by zero",
            income=500000.0,
            deductions=100000.0,
            password="user-password"
        )
        
        output = sys.stdout.getvalue()
        log_obj = json.loads(output.strip())
        
        assert log_obj["income"] == "[REDACTED]"
        assert log_obj["deductions"] == "[REDACTED]"
        assert log_obj["password"] == "[REDACTED]"
        assert log_obj["error"] == "division by zero"
    finally:
        sys.stdout = old_stdout
