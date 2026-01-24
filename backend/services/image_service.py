"""
Granite - Image Service
Handles image upload and management.
"""

import re
from datetime import datetime, timezone
from pathlib import Path

from backend.utils import validate_path_security


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing/replacing invalid characters.
    Keeps only alphanumeric chars, dots, dashes, and underscores.
    """
    parts = filename.rsplit(".", 1)
    name = parts[0]
    ext = parts[1] if len(parts) > 1 else ""

    name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)

    return f"{name}.{ext}" if ext else name


def get_attachment_dir(notes_dir: str, note_path: str) -> Path:
    """
    Get the attachments directory for a given note.
    Returns the root notes directory.
    """
    return Path(notes_dir)


def save_uploaded_image(notes_dir: str, note_path: str, filename: str, file_data: bytes) -> str | None:
    """
    Save an uploaded image to the appropriate attachments directory.
    Returns the relative path to the image if successful, None otherwise.

    Args:
        notes_dir: Base notes directory
        note_path: Path of the note the image is being uploaded to
        filename: Original filename
        file_data: Binary file data

    Returns:
        Relative path to the saved image, or None if failed
    """
    sanitized_name = sanitize_filename(filename)

    ext = Path(sanitized_name).suffix
    name_without_ext = Path(sanitized_name).stem

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    final_filename = f"{name_without_ext}-{timestamp}{ext}"

    attachments_dir = get_attachment_dir(notes_dir, note_path)

    attachments_dir.mkdir(parents=True, exist_ok=True)

    full_path = attachments_dir / final_filename

    if not validate_path_security(notes_dir, full_path):
        print(f"Security: Attempted to save image outside notes directory: {full_path}")
        return None

    try:
        with full_path.open("wb") as f:
            f.write(file_data)

        relative_path = full_path.relative_to(Path(notes_dir))
        return str(relative_path.as_posix())
    except Exception as e:
        print(f"Error saving image: {e}")
        return None


def get_all_images(notes_dir: str) -> list[dict]:
    """
    Get all images from all directories in the notes folder.
    Returns list of image dictionaries with metadata.
    """
    images = []
    notes_path = Path(notes_dir)

    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

    for image_file in notes_path.rglob("*"):
        if image_file.is_file() and image_file.suffix.lower() in image_extensions:
            relative_path = image_file.relative_to(notes_path)
            stat = image_file.stat()

            images.append(
                {
                    "name": image_file.name,
                    "path": str(relative_path.as_posix()),
                    "folder": str(relative_path.parent.as_posix()),
                    "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "size": stat.st_size,
                    "type": "image",
                }
            )

    return images
