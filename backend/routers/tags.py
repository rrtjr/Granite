"""
Granite - Tag Routes
Handles tag listing and filtering notes by tags.
"""

from fastapi import APIRouter, Depends, HTTPException

from backend.config import config
from backend.dependencies import require_auth, safe_error_message
from backend.utils import get_all_tags, get_notes_by_tag

router = APIRouter(
    prefix="/api/tags",
    dependencies=[Depends(require_auth)],
    tags=["tags"],
)


@router.get("")
async def list_tags():
    """
    Get all tags used across all notes with their counts.

    Returns:
        Dictionary mapping tag names to note counts
    """
    try:
        tags = get_all_tags(config["storage"]["notes_dir"])
        return {"tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to load tags")) from e


@router.get("/{tag_name}")
async def get_notes_by_tag_endpoint(tag_name: str):
    """
    Get all notes that have a specific tag.

    Args:
        tag_name: The tag to filter by (case-insensitive)

    Returns:
        List of notes matching the tag
    """
    try:
        notes = get_notes_by_tag(config["storage"]["notes_dir"], tag_name)
        return {"tag": tag_name, "count": len(notes), "notes": notes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to get notes by tag")) from e
