"""
Granite - Folder Service
Handles folder CRUD operations.
"""

import shutil
from pathlib import Path

from backend.utils import validate_path_security

from .tag_service import _tag_cache


def create_folder(notes_dir: str, folder_path: str) -> bool:
    """Create a new folder in the notes directory"""
    full_path = Path(notes_dir) / folder_path

    # Security check
    if not validate_path_security(notes_dir, full_path):
        return False

    full_path.mkdir(parents=True, exist_ok=True)

    return True


def get_all_folders(notes_dir: str) -> list[str]:
    """Get all folders in the notes directory, including empty ones"""
    folders = []
    notes_path = Path(notes_dir)

    for item in notes_path.rglob("*"):
        if item.is_dir():
            relative_path = item.relative_to(notes_path)
            folder_path = str(relative_path.as_posix())
            if folder_path and not folder_path.startswith("."):
                folders.append(folder_path)

    return sorted(folders)


def move_folder(notes_dir: str, old_path: str, new_path: str) -> bool:
    """Move a folder to a different location"""
    old_full_path = Path(notes_dir) / old_path
    new_full_path = Path(notes_dir) / new_path

    # Security checks
    if not validate_path_security(notes_dir, old_full_path) or not validate_path_security(notes_dir, new_full_path):
        return False

    if not old_full_path.exists() or not old_full_path.is_dir():
        return False

    # Check if target already exists
    if new_full_path.exists():
        return False

    # Invalidate cache for all notes in this folder
    old_path_str = str(old_full_path)
    keys_to_delete = [key for key in _tag_cache if key.startswith(old_path_str)]
    for key in keys_to_delete:
        del _tag_cache[key]

    # Create parent directory if needed
    new_full_path.parent.mkdir(parents=True, exist_ok=True)

    # Move the folder
    shutil.move(str(old_full_path), str(new_full_path))

    return True


def rename_folder(notes_dir: str, old_path: str, new_path: str) -> bool:
    """Rename a folder (same as move but for clarity)"""
    return move_folder(notes_dir, old_path, new_path)


def delete_folder(notes_dir: str, folder_path: str) -> bool:
    """Delete a folder and all its contents"""
    try:
        full_path = Path(notes_dir) / folder_path

        # Security check: ensure the path is within notes_dir
        if not validate_path_security(notes_dir, full_path):
            print(f"Security: Path is outside notes directory: {full_path}")
            return False

        if not full_path.exists():
            print(f"Folder does not exist: {full_path}")
            return False

        if not full_path.is_dir():
            print(f"Path is not a directory: {full_path}")
            return False

        # Invalidate cache for all notes in this folder
        folder_path_str = str(full_path)
        keys_to_delete = [key for key in _tag_cache if key.startswith(folder_path_str)]
        for key in keys_to_delete:
            del _tag_cache[key]

        # Delete the folder and all its contents
        shutil.rmtree(full_path)
        print(f"Successfully deleted folder: {full_path}")
        return True
    except Exception as e:
        print(f"Error deleting folder '{folder_path}': {e}")
        import traceback

        traceback.print_exc()
        return False
