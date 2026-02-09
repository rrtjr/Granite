"""
Granite - Tag Service
Handles tag parsing and caching for notes.
"""

from datetime import datetime, timezone
from pathlib import Path

_tag_cache: dict[str, tuple[float, list[str]]] = {}


def _normalize_tags(raw: "str | list[str]") -> list[str]:
    """
    Normalize raw tag input into a clean, deduplicated, sorted list.

    Handles:
    - Comma-separated: "meta, vault" -> ["meta", "vault"]
    - Space-separated: "meta vault" -> ["meta", "vault"]
    - Hash prefixes: "#meta #vault" -> ["meta", "vault"]
    - Mixed: "#meta, #vault" -> ["meta", "vault"]
    - Hierarchical: "meta/vault" -> ["meta", "meta/vault", "vault"]
    """
    if isinstance(raw, list):
        tokens: list[str] = []
        for item in raw:
            tokens.extend(_normalize_tags(str(item)))
        return sorted(set(tokens))

    text = raw.strip()
    if not text:
        return []

    # Commas take precedence over whitespace for splitting
    if "," in text:
        parts = text.split(",")
    else:
        parts = text.split()

    tags: set[str] = set()
    for part in parts:
        tag = part.strip().lstrip("#").strip().lower()
        if not tag:
            continue
        tags.add(tag)
        # Hierarchical tag expansion: "meta/vault" -> {"meta/vault", "meta", "vault"}
        if "/" in tag:
            for segment in tag.split("/"):
                segment = segment.strip()
                if segment:
                    tags.add(segment)

    return sorted(tags)


def parse_tags(content: str) -> list[str]:
    """
    Extract tags from YAML frontmatter in markdown content.

    Supported formats:
    ---
    tags: [python, tutorial, backend]     # Inline array
    tags: python tutorial backend         # Space-separated
    tags: python, tutorial, backend       # Comma-separated
    tags: #python #tutorial #backend      # Hash-prefixed (# stripped)
    tags: #python, #tutorial              # Mixed hash + comma
    tags: #parent/child                   # Hierarchical (expands to parent/child, parent, child)
    tags:
      - python
      - tutorial
      - #backend                          # Hash prefix in list items also stripped
    ---

    Args:
        content: Markdown content with optional YAML frontmatter

    Returns:
        List of tag strings (lowercase, no duplicates, sorted)
    """
    if not content.strip().startswith("---"):
        return []

    try:
        lines = content.split("\n")
        if lines[0].strip() != "---":
            return []

        end_idx = None
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                end_idx = i
                break

        if end_idx is None:
            return []

        frontmatter_lines = lines[1:end_idx]

        in_tags_list = False
        raw_list_items: list[str] = []
        for line in frontmatter_lines:
            stripped = line.strip()

            if stripped.startswith("tags:"):
                rest = stripped[5:].strip()
                if rest.startswith("[") and rest.endswith("]"):
                    tags_str = rest[1:-1]
                    raw_tags = [t.strip() for t in tags_str.split(",")]
                    return _normalize_tags(raw_tags)
                if rest:
                    return _normalize_tags(rest)
                in_tags_list = True
            elif in_tags_list:
                if stripped.startswith("-"):
                    tag = stripped[1:].strip()
                    if tag:
                        raw_list_items.append(tag)
                elif stripped:
                    break

        if raw_list_items:
            return _normalize_tags(raw_list_items)

        return []

    except Exception as e:
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
        mtime = file_path.stat().st_mtime
        file_key = str(file_path)

        if file_key in _tag_cache:
            cached_mtime, cached_tags = _tag_cache[file_key]
            if cached_mtime == mtime:
                return cached_tags

        with file_path.open(encoding="utf-8") as f:
            content = f.read()
            tags = parse_tags(content)

        _tag_cache[file_key] = (mtime, tags)
        return tags

    except Exception:
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
    tag_counts: dict[str, int] = {}
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
