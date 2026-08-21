import re
import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that reads incoming X-Correlation-ID and X-Amzn-Trace-Id headers
    and binds the IDs to the structlog contextvars for the duration of the request.
    """
    async def dispatch(self, request: Request, call_next):
        # Clear context variables to ensure no context leaks between requests
        structlog.contextvars.clear_contextvars()

        # Read correlation headers
        correlation_id = request.headers.get("x-correlation-id") or request.headers.get("x-request-id")
        trace_header = request.headers.get("x-amzn-trace-id")

        trace_id = None
        if trace_header:
            match = re.search(r"Root=([^;]+)", trace_header)
            if match:
                trace_id = match.group(1)

        bindings = {}
        if correlation_id:
            bindings["correlation_id"] = correlation_id
        if trace_id:
            bindings["trace_id"] = trace_id
        elif correlation_id:
            bindings["trace_id"] = correlation_id

        if bindings:
            structlog.contextvars.bind_contextvars(**bindings)

        response = await call_next(request)

        # Mirror back the headers
        if correlation_id:
            response.headers["x-correlation-id"] = correlation_id
        if trace_header:
            response.headers["x-amzn-trace-id"] = trace_header

        return response

