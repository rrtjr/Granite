"""
Granite - Search Service
Handles full-text search through notes.
"""

import re
from html import escape
from pathlib import Path


def search_notes(notes_dir: str, query: str) -> list[dict]:
    """
    Full-text search through note contents only.
    Does NOT search in file names, folder names, or paths - only note content.
    Uses character-based context extraction with highlighted matches.
    """
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
        except Exception:  # nosec B112
            continue  # Skip files that can't be read/searched

    return results
