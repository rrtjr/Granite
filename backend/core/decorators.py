"""
Granite - Route Decorators
Provides reusable decorators for route handlers to reduce boilerplate.
"""

from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import HTTPException


def handle_errors(user_message: str) -> Callable:
    """
    Decorator to handle exceptions in route handlers consistently.

    Catches all exceptions except HTTPException (which is re-raised),
    logs them, and returns a safe error message to the client.

    Args:
        user_message: User-friendly message to show if an error occurs

    Usage:
        @router.post("/endpoint")
        @handle_errors("Failed to create item")
        async def create_item(data: dict):
            # Business logic here - no try/except needed
            return {"success": True}
    """
    # Import here to avoid circular imports
    from backend.dependencies import safe_error_message

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                # Re-raise HTTP exceptions as-is (they have proper status codes)
                raise
            except Exception as e:
                # Wrap all other exceptions in HTTPException with safe message
                raise HTTPException(
                    status_code=500,
                    detail=safe_error_message(e, user_message),
                ) from e

        return wrapper

    return decorator
