"""
Granite - Custom Exception Handlers
"""

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.responses import Response


async def http_exception_handler(request: Request, exc: Exception) -> Response:
    """
    Custom exception handler for HTTP exceptions.
    Handles 401 errors specially:
    - For API requests: return JSON error
    - For page requests: redirect to login
    """
    # Ensure we're dealing with an HTTPException
    if not isinstance(exc, HTTPException):
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    # Only handle 401 errors specially
    if exc.status_code == 401:
        # Check if this is an API request
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=401, content={"detail": exc.detail})

        # For page requests, redirect to login
        return RedirectResponse(url="/login", status_code=303)

    # For all other HTTP exceptions, return default JSON response
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
