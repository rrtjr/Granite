"""
Utility functions for file operations, search, and markdown processing
"""

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

import yaml

# In-memory cache for parsed tags
# Format: {file_path: (mtime, tags)}
_tag_cache: dict[str, tuple[float, list[str]]] = {}


def validate_path_security(notes_dir: str, path: Path) -> bool:
    """
    Validate that a path is within the notes directory (security check).
    Prevents path traversal attacks.

    Args:
        notes_dir: Base notes directory
        path: Path to validate

    Returns:
        True if path is safe, False otherwise
    """
    try:
        path.resolve().relative_to(Path(notes_dir).resolve())
        return True
    except ValueError:
        return False


def ensure_directories(config: dict):
    """Create necessary directories if they don't exist"""
    dirs = [
        config["storage"]["notes_dir"],
        config["storage"]["plugins_dir"],
    ]

    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)


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

    # Note: We don't automatically delete empty folders to preserve user's folder structure

    return True


def move_folder(notes_dir: str, old_path: str, new_path: str) -> bool:
    """Move a folder to a different location"""
    import shutil

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

    # Note: We don't automatically delete empty folders to preserve user's folder structure

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

    # Note: We don't automatically delete empty folders to preserve user's folder structure

    return True


def search_notes(notes_dir: str, query: str) -> list[dict]:
    """
    Full-text search through note contents only.
    Does NOT search in file names, folder names, or paths - only note content.
    Uses character-based context extraction with highlighted matches.
    """
    from html import escape

    results = []
    notes_path = Path(notes_dir)

    for md_file in notes_path.rglob("*.md"):
        try:
            with md_file.open(encoding="utf-8") as f:
                content = f.read()

            # Find all matches using regex (case-insensitive)
            matches = list(re.finditer(re.escape(query), content, re.IGNORECASE))

            if matches:
                matched_lines = []

                for match in matches[:3]:  # Limit to 3 matches per file
                    start_index = match.start()
                    end_index = match.end()
                    matched_text = match.group()  # Preserve original case

                    # Create slice window: ±15 characters around match
                    context_start = max(0, start_index - 15)
                    context_end = min(len(content), end_index + 15)

                    # Extract and clean parts (newlines → spaces)
                    before = escape(content[context_start:start_index].replace("\n", " "))
                    after = escape(content[end_index:context_end].replace("\n", " "))
                    matched_clean = escape(matched_text.replace("\n", " "))

                    # Build snippet with <mark> highlight (styled via CSS)
                    snippet = f'{before}<mark class="search-highlight">{matched_clean}</mark>{after}'

                    # Add ellipsis if truncated at start
                    if context_start > 0:
                        snippet = "..." + snippet

                    # Add ellipsis if truncated at end
                    if context_end < len(content):
                        snippet = snippet + "..."

                    # Calculate line number by counting newlines up to match start
                    line_number = content.count("\n", 0, start_index) + 1

                    matched_lines.append({"line_number": line_number, "context": snippet})

                relative_path = md_file.relative_to(notes_path)
                results.append(
                    {
                        "name": md_file.stem,
                        "path": str(relative_path.as_posix()),
                        "folder": str(relative_path.parent.as_posix()) if str(relative_path.parent) != "." else "",
                        "matches": matched_lines,
                    }
                )
        except Exception:
            continue

    return results


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


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing/replacing invalid characters.
    Keeps only alphanumeric chars, dots, dashes, and underscores.
    """
    # Get the extension first
    parts = filename.rsplit(".", 1)
    name = parts[0]
    ext = parts[1] if len(parts) > 1 else ""

    # Remove/replace invalid characters
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)

    # Rejoin with extension
    return f"{name}.{ext}" if ext else name


def get_attachment_dir(notes_dir: str, note_path: str) -> Path:
    """
    Get the attachments directory for a given note.
    Returns the root notes directory.
    """
    # Save all images to root folder
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
    # Sanitize filename
    sanitized_name = sanitize_filename(filename)

    # Get extension
    ext = Path(sanitized_name).suffix
    name_without_ext = Path(sanitized_name).stem

    # Add timestamp to prevent collisions
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    final_filename = f"{name_without_ext}-{timestamp}{ext}"

    # Get attachments directory
    attachments_dir = get_attachment_dir(notes_dir, note_path)

    # Create directory if it doesn't exist
    attachments_dir.mkdir(parents=True, exist_ok=True)

    # Full path to save the image
    full_path = attachments_dir / final_filename

    # Security check
    if not validate_path_security(notes_dir, full_path):
        print(f"Security: Attempted to save image outside notes directory: {full_path}")
        return None

    try:
        # Write the file
        with full_path.open("wb") as f:
            f.write(file_data)

        # Return relative path from notes_dir
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

    # Common image extensions
    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

    # Find all image files recursively in the notes directory
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


def parse_tags(content: str) -> list[str]:
    """
    Extract tags from YAML frontmatter in markdown content.

    Supported formats:
    ---
    tags: [python, tutorial, backend]
    ---

    or

    ---
    tags:
      - python
      - tutorial
      - backend
    ---

    Args:
        content: Markdown content with optional YAML frontmatter

    Returns:
        List of tag strings (lowercase, no duplicates)
    """
    tags = []

    # Check if content starts with frontmatter
    if not content.strip().startswith("---"):
        return tags

    try:
        # Extract frontmatter (between first two --- markers)
        lines = content.split("\n")
        if lines[0].strip() != "---":
            return tags

        # Find closing ---
        end_idx = None
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                end_idx = i
                break

        if end_idx is None:
            return tags

        frontmatter_lines = lines[1:end_idx]

        # Parse tags field
        in_tags_list = False
        for line in frontmatter_lines:
            stripped = line.strip()

            # Check for inline array format: tags: [tag1, tag2, tag3]
            if stripped.startswith("tags:"):
                rest = stripped[5:].strip()
                if rest.startswith("[") and rest.endswith("]"):
                    # Parse inline array
                    tags_str = rest[1:-1]  # Remove [ and ]
                    raw_tags = [t.strip() for t in tags_str.split(",")]
                    tags.extend([t.lower() for t in raw_tags if t])
                    break
                if rest:
                    # Single tag without brackets
                    tags.append(rest.lower())
                    break
                # Multi-line list format
                in_tags_list = True
            elif in_tags_list:
                if stripped.startswith("-"):
                    # List item
                    tag = stripped[1:].strip()
                    if tag:
                        tags.append(tag.lower())
                elif stripped and not stripped.startswith("#"):
                    # End of tags list
                    break

        # Remove duplicates and return
        return sorted(set(tags))

    except Exception as e:
        # If parsing fails, return empty list
        print(f"Error parsing tags: {e}")
        return []


def get_tags_cached(file_path: Path) -> list[str]:
    """
    Get tags for a file with caching based on modification time.

    Args:
        file_path: Path to the markdown file

    Returns:
        List of tags from the file (cached if mtime unchanged)
    """
    try:
        # Get current modification time
        mtime = file_path.stat().st_mtime
        file_key = str(file_path)

        # Check cache
        if file_key in _tag_cache:
            cached_mtime, cached_tags = _tag_cache[file_key]
            if cached_mtime == mtime:
                # Cache hit! Return cached tags
                return cached_tags

        # Cache miss or stale - parse tags
        with file_path.open(encoding="utf-8") as f:
            content = f.read()
            tags = parse_tags(content)

        # Update cache
        _tag_cache[file_key] = (mtime, tags)
        return tags

    except Exception:
        # If anything fails, return empty list
        return []


def clear_tag_cache():
    """Clear the tag cache (useful for testing or manual cache invalidation)"""
    _tag_cache.clear()


def get_all_tags(notes_dir: str) -> dict[str, int]:
    """
    Get all tags used across all notes with their count (cached).

    Args:
        notes_dir: Directory containing notes

    Returns:
        Dictionary mapping tag names to note counts
    """
    tag_counts = {}
    notes_path = Path(notes_dir)

    for md_file in notes_path.rglob("*.md"):
        # Get tags using cache
        tags = get_tags_cached(md_file)

        for tag in tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    return dict(sorted(tag_counts.items()))


def get_notes_by_tag(notes_dir: str, tag: str) -> list[dict]:
    """
    Get all notes that have a specific tag (cached).

    Args:
        notes_dir: Directory containing notes
        tag: Tag to filter by (case-insensitive)

    Returns:
        List of note dictionaries matching the tag
    """
    matching_notes = []
    tag_lower = tag.lower()
    notes_path = Path(notes_dir)

    for md_file in notes_path.rglob("*.md"):
        # Get tags using cache
        tags = get_tags_cached(md_file)

        if tag_lower in tags:
            relative_path = md_file.relative_to(notes_path)
            stat = md_file.stat()

            matching_notes.append(
                {
                    "name": md_file.stem,
                    "path": str(relative_path.as_posix()),
                    "folder": str(relative_path.parent.as_posix()) if str(relative_path.parent) != "." else "",
                    "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "size": stat.st_size,
                    "tags": tags,
                }
            )

    return matching_notes


# ============================================================================
# Template Functions
# ============================================================================


def get_templates(notes_dir: str, templates_dir: str | None = None) -> list[dict]:
    """
    Get all templates from the templates folder.

    Args:
        notes_dir: Base notes directory
        templates_dir: Templates directory path relative to notes_dir, or absolute path (defaults to _templates)

    Returns:
        List of template metadata (name, path, modified)
    """
    templates = []

    # Resolve templates_dir relative to notes_dir if not absolute
    if templates_dir:
        templates_path = Path(templates_dir)
        # If not absolute, resolve relative to notes_dir
        if not templates_path.is_absolute():
            templates_path = Path(notes_dir) / templates_dir
    else:
        templates_path = Path(notes_dir) / "_templates"

    if not templates_path.exists():
        return templates

    # Security check: ensure templates folder is within notes directory
    if not validate_path_security(notes_dir, templates_path):
        print(f"Security: Templates directory is outside notes directory: {templates_path}")
        return templates

    try:
        for template_file in templates_path.glob("*.md"):
            try:
                # Security check: ensure each template is within notes directory
                if not validate_path_security(notes_dir, template_file):
                    print(f"Security: Skipping template outside notes directory: {template_file}")
                    continue

                stat = template_file.stat()
                templates.append(
                    {
                        "name": template_file.stem,
                        "path": str(template_file.relative_to(notes_dir).as_posix()),
                        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    }
                )
            except Exception as e:
                print(f"Error reading template {template_file}: {e}")
                continue
    except Exception as e:
        print(f"Error accessing templates directory: {e}")

    return sorted(templates, key=lambda x: x["name"])


def get_template_content(notes_dir: str, template_name: str, templates_dir: str | None = None) -> str | None:
    """
    Get the content of a specific template.

    Args:
        notes_dir: Base notes directory
        template_name: Name of the template (without .md extension)
        templates_dir: Templates directory path relative to notes_dir, or absolute path (defaults to _templates)

    Returns:
        Template content or None if not found
    """
    # Resolve templates_dir relative to notes_dir if not absolute
    if templates_dir:
        templates_path = Path(templates_dir)
        # If not absolute, resolve relative to notes_dir
        if not templates_path.is_absolute():
            templates_path = Path(notes_dir) / templates_dir
        template_path = templates_path / f"{template_name}.md"
    else:
        template_path = Path(notes_dir) / "_templates" / f"{template_name}.md"

    if not template_path.exists():
        return None

    # Security check: ensure template is within notes directory
    if not validate_path_security(notes_dir, template_path):
        print(f"Security: Template path is outside notes directory: {template_path}")
        return None

    try:
        with template_path.open(encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"Error reading template {template_name}: {e}")
        return None


def apply_template_placeholders(content: str, note_path: str) -> str:
    """
    Replace template placeholders with actual values.

    Supported placeholders:
        {{date}}      - Current date (YYYY-MM-DD)
        {{time}}      - Current time (HH:MM:SS)
        {{datetime}}  - Current datetime (YYYY-MM-DD HH:MM:SS)
        {{timestamp}} - Unix timestamp
        {{title}}     - Note name without extension
        {{folder}}    - Parent folder name

    Args:
        content: Template content with placeholders
        note_path: Path of the note being created

    Returns:
        Content with placeholders replaced
    """
    now = datetime.now(timezone.utc)
    note = Path(note_path)

    replacements = {
        "{{date}}": now.strftime("%Y-%m-%d"),
        "{{time}}": now.strftime("%H:%M:%S"),
        "{{datetime}}": now.strftime("%Y-%m-%d %H:%M:%S"),
        "{{timestamp}}": str(int(now.timestamp())),
        "{{title}}": note.stem,
        "{{folder}}": note.parent.name if str(note.parent) != "." else "Root",
    }

    result = content
    for placeholder, value in replacements.items():
        result = result.replace(placeholder, value)

    return result


# ============================================================================
# Config Management Functions
# ============================================================================


def update_config_value(config_path: Path, key_path: str, value: str) -> bool:
    """
    Update a configuration value in config.yaml.

    Args:
        config_path: Path to config.yaml file
        key_path: Dot-separated path to the config key (e.g., "storage.templates_dir")
        value: New value to set

    Returns:
        True if successful, False otherwise
    """
    try:
        # Read current config
        with config_path.open("r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        # Navigate to the correct nested location and update
        keys = key_path.split(".")
        current = config
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]

        # Set the value
        current[keys[-1]] = value

        # Write back to file
        with config_path.open("w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)

        return True
    except Exception as e:
        print(f"Error updating config: {e}")
        return False


# ============================================================================
# User Settings Management Functions
# ============================================================================


def get_default_user_settings() -> dict:
    """
    Get default user settings structure.

    Returns:
        Dictionary with default user settings
    """
    return {
        "reading": {
            "width": "full",  # 'narrow', 'medium', 'wide', 'full'
            "align": "left",  # 'left', 'center', 'justified'
            "margins": "normal",  # 'compact', 'normal', 'relaxed', 'extra-relaxed'
        },
        "performance": {
            "updateDelay": 100,
            "statsDelay": 300,
            "metadataDelay": 300,
            "historyDelay": 500,
            "autosaveDelay": 1000,
        },
        "paths": {"templatesDir": "_templates"},
    }


def load_user_settings(settings_path: Path) -> dict:
    """
    Load user settings from user-settings.json.
    Creates file with defaults if it doesn't exist.

    Args:
        settings_path: Path to user-settings.json file

    Returns:
        Dictionary with user settings
    """
    try:
        if settings_path.exists():
            with settings_path.open("r", encoding="utf-8") as f:
                settings = json.load(f)
                # Merge with defaults to ensure all keys exist
                defaults = get_default_user_settings()
                for section in defaults:
                    if section not in settings:
                        settings[section] = defaults[section]
                    else:
                        # Merge section-level defaults
                        for key in defaults[section]:
                            if key not in settings[section]:
                                settings[section][key] = defaults[section][key]
                return settings
        else:
            # Create default settings file
            defaults = get_default_user_settings()
            save_user_settings(settings_path, defaults)
            return defaults
    except Exception as e:
        print(f"Error loading user settings: {e}")
        return get_default_user_settings()


def save_user_settings(settings_path: Path, settings: dict) -> bool:
    """
    Save user settings to user-settings.json.

    Args:
        settings_path: Path to user-settings.json file
        settings: Settings dictionary to save

    Returns:
        True if successful, False otherwise
    """
    try:
        # Ensure parent directory exists
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with settings_path.open("w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving user settings: {e}")
        return False


def update_user_setting(settings_path: Path, section: str, key: str, value) -> tuple[bool, dict]:
    """
    Update a specific user setting.

    Args:
        settings_path: Path to user-settings.json file
        section: Setting section ('reading', 'performance', 'paths')
        key: Setting key within section
        value: New value

    Returns:
        Tuple of (success, updated_settings)
    """
    try:
        settings = load_user_settings(settings_path)

        if section not in settings:
            settings[section] = {}

        settings[section][key] = value

        success = save_user_settings(settings_path, settings)
        return success, settings
    except Exception as e:
        print(f"Error updating user setting: {e}")
        return False, get_default_user_settings()
