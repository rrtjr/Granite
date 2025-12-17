"""
Custom middleware for Granite
Includes security headers, request logging, and performance monitoring
"""

import time
import uuid
from collections.abc import Callable
from contextvars import ContextVar

from fastapi import Request, Response
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable for request ID tracking
request_id_var: ContextVar[str] = ContextVar("request_id", default=None)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses

    Headers added:
    - X-Frame-Options: DENY (prevents clickjacking)
    - X-Content-Type-Options: nosniff (prevents MIME type sniffing)
    - X-XSS-Protection: 1; mode=block (legacy XSS protection)
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: restricts dangerous browser features
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Security headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Content Security Policy for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = "default-src 'none'"

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Log all HTTP requests with method, path, status, and duration
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        request_id_var.set(request_id)

        # Start timer
        start_time = time.time()

        # Log request start
        logger.info(
            f"Request started: {request.method} {request.url.path} "
            f"[ID: {request_id[:8]}] [Client: {request.client.host if request.client else 'unknown'}]"
        )

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration_ms = round((time.time() - start_time) * 1000, 2)

            # Log request completion
            log_message = (
                f"Request completed: {request.method} {request.url.path} "
                f"[Status: {response.status_code}] [Duration: {duration_ms}ms] [ID: {request_id[:8]}]"
            )

            if response.status_code >= 500:
                logger.error(log_message)
            elif response.status_code >= 400:
                logger.warning(log_message)
            else:
                logger.info(log_message)

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"Request failed: {request.method} {request.url.path} "
                f"[Error: {type(e).__name__}: {e!s}] [Duration: {duration_ms}ms] [ID: {request_id[:8]}]",
                exc_info=True,
            )
            raise


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Monitor slow requests and log warnings
    """

    def __init__(self, app, slow_request_threshold_ms: float = 1000.0):
        super().__init__(app)
        self.slow_request_threshold_ms = slow_request_threshold_ms

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000

        # Warn about slow requests
        if duration_ms > self.slow_request_threshold_ms:
            logger.warning(
                f"Slow request detected: {request.method} {request.url.path} "
                f"took {round(duration_ms, 2)}ms (threshold: {self.slow_request_threshold_ms}ms)"
            )

        # Add performance header
        response.headers["X-Response-Time-Ms"] = str(round(duration_ms, 2))

        return response


def get_request_id() -> str:
    """
    Get the current request ID from context

    Returns:
        Request ID string, or 'no-request-id' if not in request context
    """
    return request_id_var.get() or "no-request-id"
