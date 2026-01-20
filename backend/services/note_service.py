"""
Granite - Note Service
Handles note CRUD operations.
"""

from datetime import datetime, timezone
from pathlib import Path

from backend.utils import validate_path_security

from .image_service import get_all_images
from .tag_service import _tag_cache, get_tags_cached


def move_note(notes_dir: str, old_path: str, new_path: str) -> bool:
    """Move a note to a different location"""
    old_full_path = Path(notes_dir) / old_path
    new_full_path = Path(notes_dir) / new_path

    # Security checks
    if not validate_path_security(notes_dir, old_full_path) or not validate_path_security(notes_dir, new_full_path):
        return False

    if not old_full_path.exists():
        return False

    # Check if target already exists (prevent overwriting)
    if new_full_path.exists():
        return False

    # Invalidate cache for old path
    old_key = str(old_full_path)
    _tag_cache.pop(old_key, None)

    # Create parent directory if needed
    new_full_path.parent.mkdir(parents=True, exist_ok=True)

    # Move the file
    old_full_path.rename(new_full_path)

    return True


def get_all_notes(notes_dir: str) -> list[dict]:
    """Recursively get all markdown notes and images"""
    items = []
    notes_path = Path(notes_dir)

    # Get all markdown notes
    for md_file in notes_path.rglob("*.md"):
        relative_path = md_file.relative_to(notes_path)
        stat = md_file.stat()

        # Get tags for this note (cached)
        tags = get_tags_cached(md_file)

        items.append(
            {
                "name": md_file.stem,
                "path": str(relative_path.as_posix()),
                "folder": str(relative_path.parent.as_posix()) if str(relative_path.parent) != "." else "",
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "size": stat.st_size,
                "type": "note",
                "tags": tags,
            }
        )

    # Get all images
    images = get_all_images(notes_dir)
    items.extend(images)

    return sorted(items, key=lambda x: x["modified"], reverse=True)


def get_note_content(notes_dir: str, note_path: str) -> str | None:
    """Get the content of a specific note"""
    full_path = Path(notes_dir) / note_path

    if not full_path.exists() or not full_path.is_file():
        return None

    # Security check: ensure the path is within notes_dir
    if not validate_path_security(notes_dir, full_path):
        return None

    with full_path.open(encoding="utf-8") as f:
        return f.read()


def save_note(notes_dir: str, note_path: str, content: str) -> bool:
    """Save or update a note"""
    full_path = Path(notes_dir) / note_path

    # Ensure .md extension
    if not note_path.endswith(".md"):
        full_path = full_path.with_suffix(".md")

    # Security check
    if not validate_path_security(notes_dir, full_path):
        return False

    # Create parent directories if needed
    full_path.parent.mkdir(parents=True, exist_ok=True)

    with full_path.open("w", encoding="utf-8") as f:
        f.write(content)

    return True


def delete_note(notes_dir: str, note_path: str) -> bool:
    """Delete a note"""
    full_path = Path(notes_dir) / note_path

    if not full_path.exists():
        return False

    # Security check
    if not validate_path_security(notes_dir, full_path):
        return False

    # Invalidate cache for this note
    file_key = str(full_path)
    _tag_cache.pop(file_key, None)

    full_path.unlink()

    return True


def create_note_metadata(notes_dir: str, note_path: str) -> dict:
    """Get metadata for a note"""
    full_path = Path(notes_dir) / note_path

    if not full_path.exists():
        return {}

    stat = full_path.stat()

    # Count lines with proper file handle management
    with full_path.open(encoding="utf-8") as f:
        line_count = sum(1 for _ in f)

    return {
        "created": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "size": stat.st_size,
        "lines": line_count,
    }
