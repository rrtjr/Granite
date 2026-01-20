"""
Granite - Shared Utilities
Core utility functions used across services.
"""

from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


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


# ============================================================================
# Timezone and Datetime Functions
# ============================================================================


def get_timezone_from_setting(tz_setting: str) -> ZoneInfo | timezone | None:
    """
    Convert a timezone setting string to a timezone object.

    Args:
        tz_setting: "local", "UTC", or IANA timezone name (e.g., "America/New_York")

    Returns:
        ZoneInfo for IANA timezones, timezone.utc for UTC, or None for local time
    """
    if tz_setting == "UTC":
        return timezone.utc
    if tz_setting == "local":
        return None  # Use local time (no tz conversion)
    try:
        return ZoneInfo(tz_setting)
    except Exception:
        return timezone.utc  # Fallback to UTC if invalid


def get_ordinal_suffix(day: int) -> str:
    """
    Get the ordinal suffix for a day number.

    Args:
        day: Day of month (1-31)

    Returns:
        Ordinal suffix (st, nd, rd, th)
    """
    if 11 <= day <= 13:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")


def format_datetime_for_frontmatter(tz_setting: str = "local") -> str:
    """
    Format current datetime for frontmatter according to user timezone settings.

    Args:
        tz_setting: Timezone setting from user settings

    Returns:
        Formatted datetime string like "Saturday 5th April 2025 12:00:00 AM GMT+08:00"
    """
    tz = get_timezone_from_setting(tz_setting)

    if tz is None:
        # Local time - use system timezone
        dt = datetime.now(tz=timezone.utc).astimezone()
    else:
        # Convert to specified timezone
        now = datetime.now(timezone.utc)
        dt = now.astimezone(tz)

    # Build the formatted string
    day_name = dt.strftime("%A")
    day = dt.day
    ordinal = get_ordinal_suffix(day)
    month_name = dt.strftime("%B")
    year = dt.year
    time_str = dt.strftime("%I:%M:%S %p")

    # Format timezone offset as GMT±HH:MM
    utc_offset = dt.strftime("%z")  # e.g., +0800 or -0500
    if utc_offset:
        sign = utc_offset[0]
        hours = utc_offset[1:3]
        minutes = utc_offset[3:5]
        tz_str = f"GMT{sign}{hours}:{minutes}"
    else:
        tz_str = "GMT+00:00"

    return f"{day_name} {day}{ordinal} {month_name} {year} {time_str} {tz_str}"


def update_frontmatter_field(content: str, field: str, value: str) -> str:
    """
    Update or add a field in YAML frontmatter.

    Args:
        content: Full note content with frontmatter
        field: Field name to update (e.g., "modified")
        value: New value for the field

    Returns:
        Content with updated frontmatter, or original content if no frontmatter
    """
    if not content.strip().startswith("---"):
        return content  # No frontmatter, return unchanged

    lines = content.split("\n")
    if lines[0].strip() != "---":
        return content

    # Find closing ---
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        return content  # Malformed frontmatter

    # Check if field exists and update it
    field_found = False
    for i in range(1, end_idx):
        if lines[i].startswith(f"{field}:"):
            lines[i] = f"{field}: {value}"
            field_found = True
            break

    # Add field if not found (before closing ---)
    if not field_found:
        lines.insert(end_idx, f"{field}: {value}")

    return "\n".join(lines)


# ============================================================================
# Re-exports for backward compatibility
# ============================================================================
# These imports allow existing code to continue using `from backend.utils import ...`

from backend.services import (  # noqa: E402, F401
    apply_template_placeholders,
    clear_tag_cache,
    create_folder,
    create_note_metadata,
    delete_folder,
    delete_note,
    get_all_folders,
    get_all_images,
    get_all_notes,
    get_all_tags,
    get_attachment_dir,
    get_default_user_settings,
    get_note_content,
    get_notes_by_tag,
    get_tags_cached,
    get_template_content,
    get_templates,
    load_user_settings,
    move_folder,
    move_note,
    parse_tags,
    rename_folder,
    sanitize_filename,
    save_note,
    save_uploaded_image,
    save_user_settings,
    search_notes,
    update_config_value,
    update_user_setting,
)
