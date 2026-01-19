"""
Granite - Page Routes
Handles HTML page serving including the SPA catch-all route.
"""

import aiofiles  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from backend.config import static_path
from backend.dependencies import require_auth

router = APIRouter(
    dependencies=[Depends(require_auth)],
    tags=["pages"],
)


@router.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main application page"""
    index_path = static_path / "index.html"
    async with aiofiles.open(index_path, encoding="utf-8") as f:
        return await f.read()


# Catch-all route for SPA (Single Page Application) routing
# This allows URLs like /folder/note to work for direct navigation
@router.get("/{full_path:path}", response_class=HTMLResponse)
async def catch_all(full_path: str, request: Request):
    """
    Serve index.html for all non-API routes.
    This enables client-side routing (e.g., /folder/note)
    """
    # Skip if it's an API route or static file (shouldn't reach here, but just in case)
    if full_path.startswith(("api/", "static/")):
        raise HTTPException(status_code=404, detail="Not found")

    # Serve index.html for all other routes
    index_path = static_path / "index.html"
    async with aiofiles.open(index_path, encoding="utf-8") as f:
        return await f.read()
