import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that reads incoming X-Correlation-ID headers and binds
    the ID to the structlog contextvars for the duration of the request.
    """
    async def dispatch(self, request: Request, call_next):
        # Clear context variables to ensure no context leaks between requests
        structlog.contextvars.clear_contextvars()

        # Read header (case-insensitive in HTTP)
        correlation_id = request.headers.get("x-correlation-id") or request.headers.get("x-request-id")

        if correlation_id:
            # Bind the correlation_id to structlog context
            structlog.contextvars.bind_contextvars(correlation_id=correlation_id)

        response = await call_next(request)

        # Mirror back the correlation ID in the response headers
        if correlation_id:
            response.headers["x-correlation-id"] = correlation_id

        return response
