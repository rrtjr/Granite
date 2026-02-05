"""
Granite - Draw.io Cache Routes
Handles caching of Draw.io diagram SVG previews.
"""

import hashlib
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from backend.config import config
from backend.core.decorators import handle_errors
from backend.dependencies import require_auth

# Default cache TTL: 30 days in seconds
DEFAULT_CACHE_TTL = 30 * 24 * 60 * 60

router = APIRouter(
    prefix="/api/drawio-cache",
    dependencies=[Depends(require_auth)],
    tags=["drawio"],
)

# Cache directory name (hidden folder in notes_dir)
CACHE_DIR = ".drawio-cache"


def get_cache_dir() -> Path:
    """Get the draw.io cache directory, creating it if needed."""
    notes_dir = Path(config["storage"]["notes_dir"])
    cache_dir = notes_dir / CACHE_DIR
    cache_dir.mkdir(exist_ok=True)
    return cache_dir


def hash_xml(xml: str) -> str:
    """Generate a short hash from XML content for cache key."""
    return hashlib.sha256(xml.encode("utf-8")).hexdigest()[:16]


class CacheSaveRequest(BaseModel):
    """Request body for saving SVG to cache."""

    xml: str
    svg: str


@router.post("")
@handle_errors("Failed to save draw.io cache")
async def save_cache(request: CacheSaveRequest):
    """
    Save an SVG preview to the cache.
    The cache key is derived from a hash of the XML content.
    """
    if not request.xml or not request.svg:
        raise HTTPException(status_code=400, detail="XML and SVG content required")

    # Generate cache key from XML hash
    cache_key = hash_xml(request.xml)
    cache_file = get_cache_dir() / f"{cache_key}.svg"

    # Save SVG to cache file
    cache_file.write_text(request.svg, encoding="utf-8")

    return {
        "success": True,
        "hash": cache_key,
        "message": "SVG cached successfully",
    }


@router.get("/{xml_hash}")
@handle_errors("Failed to load draw.io cache")
async def get_cache(xml_hash: str):
    """
    Retrieve a cached SVG preview by its XML hash.
    Returns 404 if not found.
    """
    # Validate hash format (16 hex chars)
    if not xml_hash or len(xml_hash) != 16 or not all(c in "0123456789abcdef" for c in xml_hash.lower()):
        raise HTTPException(status_code=400, detail="Invalid cache hash")

    cache_file = get_cache_dir() / f"{xml_hash}.svg"

    if not cache_file.exists():
        raise HTTPException(status_code=404, detail="Cache not found")

    svg_content = cache_file.read_text(encoding="utf-8")

    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},  # Cache for 1 day
    )


@router.delete("/{xml_hash}")
@handle_errors("Failed to delete draw.io cache")
async def delete_cache(xml_hash: str):
    """
    Delete a cached SVG preview.
    """
    if not xml_hash or len(xml_hash) != 16:
        raise HTTPException(status_code=400, detail="Invalid cache hash")

    cache_file = get_cache_dir() / f"{xml_hash}.svg"

    if cache_file.exists():
        cache_file.unlink()

    return {"success": True, "message": "Cache deleted"}


@router.get("")
@handle_errors("Failed to get cache stats")
async def get_cache_stats():
    """
    Get cache statistics: file count, total size, oldest file age.
    """
    cache_dir = get_cache_dir()
    files = list(cache_dir.glob("*.svg"))

    total_size = 0
    oldest_mtime = None
    now = time.time()

    for f in files:
        stat = f.stat()
        total_size += stat.st_size
        if oldest_mtime is None or stat.st_mtime < oldest_mtime:
            oldest_mtime = stat.st_mtime

    oldest_age_days = None
    if oldest_mtime:
        oldest_age_days = round((now - oldest_mtime) / (24 * 60 * 60), 1)

    return {
        "file_count": len(files),
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "oldest_file_age_days": oldest_age_days,
    }


@router.post("/cleanup")
@handle_errors("Failed to cleanup cache")
async def cleanup_cache(max_age_days: int = Query(default=30, ge=1, le=365)):
    """
    Remove cache files older than specified days.
    Default: 30 days.
    """
    cache_dir = get_cache_dir()
    files = list(cache_dir.glob("*.svg"))
    now = time.time()
    max_age_seconds = max_age_days * 24 * 60 * 60

    deleted_count = 0
    deleted_size = 0

    for f in files:
        try:
            stat = f.stat()
            age = now - stat.st_mtime
            if age > max_age_seconds:
                deleted_size += stat.st_size
                f.unlink()
                deleted_count += 1
        except OSError:
            pass  # File may have been deleted by another process

    return {
        "success": True,
        "deleted_count": deleted_count,
        "deleted_size_bytes": deleted_size,
        "deleted_size_mb": round(deleted_size / (1024 * 1024), 2),
        "message": f"Removed {deleted_count} files older than {max_age_days} days",
    }


@router.delete("")
@handle_errors("Failed to clear cache")
async def clear_all_cache():
    """
    Delete ALL cached SVG files. Use with caution.
    """
    cache_dir = get_cache_dir()
    files = list(cache_dir.glob("*.svg"))

    deleted_count = 0
    for f in files:
        try:
            f.unlink()
            deleted_count += 1
        except OSError:
            pass

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Cleared {deleted_count} cached files",
    }
