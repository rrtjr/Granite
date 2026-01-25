"""
Granite - Template Service
Handles template loading and placeholder processing.
"""

from datetime import datetime, timezone
from pathlib import Path

from backend.utils import (
    format_datetime_for_frontmatter,
    get_timezone_from_setting,
    validate_path_security,
)


def get_templates(notes_dir: str, templates_dir: str | None = None) -> list[dict]:
    """
    Get all templates from the templates folder.

    Args:
        notes_dir: Base notes directory
        templates_dir: Templates directory path relative to notes_dir, or absolute path (defaults to _templates)

    Returns:
        List of template metadata (name, path, modified)
    """
    templates: list[dict[str, str]] = []

    if templates_dir:
        templates_path = Path(templates_dir)
        if not templates_path.is_absolute():
            templates_path = Path(notes_dir) / templates_dir
    else:
        templates_path = Path(notes_dir) / "_templates"

    if not templates_path.exists():
        return templates

    if not validate_path_security(notes_dir, templates_path):
        print(f"Security: Templates directory is outside notes directory: {templates_path}")
        return templates

    try:
        for template_file in templates_path.glob("*.md"):
            try:
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
    if templates_dir:
        templates_path = Path(templates_dir)
        if not templates_path.is_absolute():
            templates_path = Path(notes_dir) / templates_dir
        template_path = templates_path / f"{template_name}.md"
    else:
        template_path = Path(notes_dir) / "_templates" / f"{template_name}.md"

    if not template_path.exists():
        return None

    if not validate_path_security(notes_dir, template_path):
        print(f"Security: Template path is outside notes directory: {template_path}")
        return None

    try:
        with template_path.open(encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"Error reading template {template_name}: {e}")
        return None


def apply_template_placeholders(content: str, note_path: str, user_settings: dict | None = None) -> str:
    """
    Replace template placeholders with actual values.

    Supported placeholders:
        {{date}}      - Current date (YYYY-MM-DD)
        {{time}}      - Current time (HH:MM:SS)
        {{datetime}}  - Current datetime (YYYY-MM-DD HH:MM:SS)
        {{timestamp}} - Unix timestamp
        {{title}}     - Note name without extension
        {{folder}}    - Parent folder name
        {{created}}   - Current datetime for created field (YYYY-MM-DD HH:MM:SS)
        {{modified}}  - Current datetime for modified field (YYYY-MM-DD HH:MM:SS)

    Args:
        content: Template content with placeholders
        note_path: Path of the note being created
        user_settings: Optional user settings for timezone configuration

    Returns:
        Content with placeholders replaced
    """
    tz_setting = "local"
    if user_settings and "datetime" in user_settings:
        tz_setting = user_settings["datetime"].get("timezone", "local")

    tz = get_timezone_from_setting(tz_setting)

    if tz is None:
        local_now = datetime.now(tz=timezone.utc).astimezone()
    else:
        utc_now = datetime.now(timezone.utc)
        local_now = utc_now.astimezone(tz)

    note = Path(note_path)

    datetime_str = local_now.strftime("%Y-%m-%d %H:%M:%S")
    frontmatter_datetime = format_datetime_for_frontmatter(tz_setting)

    replacements = {
        "{{date}}": local_now.strftime("%Y-%m-%d"),
        "{{time}}": local_now.strftime("%H:%M:%S"),
        "{{datetime}}": datetime_str,
        "{{timestamp}}": str(int(local_now.timestamp())),
        "{{title}}": note.stem,
        "{{folder}}": note.parent.name if str(note.parent) != "." else "Root",
        "{{created}}": frontmatter_datetime,
        "{{modified}}": frontmatter_datetime,
    }

    result = content
    for placeholder, value in replacements.items():
        result = result.replace(placeholder, value)

    return result
