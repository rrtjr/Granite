"""
Granite - Tag Routes
Handles tag listing and filtering notes by tags.
"""

from fastapi import APIRouter, Depends

from backend.config import config
from backend.core.decorators import handle_errors
from backend.dependencies import require_auth
from backend.services import get_all_tags, get_notes_by_tag

router = APIRouter(
    prefix="/api/tags",
    dependencies=[Depends(require_auth)],
    tags=["tags"],
)


@router.get("")
@handle_errors("Failed to load tags")
async def list_tags():
    """
    Get all tags used across all notes with their counts.

    Returns:
        Dictionary mapping tag names to note counts
    """
    tags = get_all_tags(config["storage"]["notes_dir"])
    return {"tags": tags}


@router.get("/{tag_name}")
@handle_errors("Failed to get notes by tag")
async def get_notes_by_tag_endpoint(tag_name: str):
    """
    Get all notes that have a specific tag.

    Args:
        tag_name: The tag to filter by (case-insensitive)

    Returns:
        List of notes matching the tag
    """
    notes = get_notes_by_tag(config["storage"]["notes_dir"], tag_name)
    return {"tag": tag_name, "count": len(notes), "notes": notes}
