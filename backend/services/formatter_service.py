import re


def format_markdown(content: str) -> str:
    """
    Format markdown content.
    - Adds space after headers (#Header -> # Header)
    - Aligns markdown tables
    """
    # First pass: Handle headers and preserve blocks
    lines = content.splitlines()
    formatted_lines = []

    in_code_block = False
    in_frontmatter = False

    table_buffer: list[str] = []

    for i, line in enumerate(lines):
        # Frontmatter detection
        if i == 0 and line.strip() == "---":
            in_frontmatter = True
            if table_buffer:
                formatted_lines.extend(format_table(table_buffer))
                table_buffer = []
            formatted_lines.append(line)
            continue

        if in_frontmatter:
            formatted_lines.append(line)
            if line.strip() == "---":
                in_frontmatter = False
            continue

        # Code block detection
        if line.strip().startswith("```"):
            if table_buffer:
                formatted_lines.extend(format_table(table_buffer))
                table_buffer = []
            in_code_block = not in_code_block
            formatted_lines.append(line)
            continue

        if in_code_block:
            formatted_lines.append(line)
            continue

        # If we are here, we are in normal text

        # Table detection
        # Simple heuristic: line starts with | or (starts with space and |)
        # But we need to distinguish between casual use of | and a table.
        # Markdown tables usually have pipes.
        if line.strip().startswith("|"):
            table_buffer.append(line)
            continue
        if table_buffer:
            formatted_lines.extend(format_table(table_buffer))
            table_buffer = []

        # Header formatting
        # #Header -> # Header
        # Regex: Start of line (with optional space), one or more #, then NOT space/tab/newline/hash
        if line.strip().startswith("#"):
            # Handle optional leading whitespace
            formatted_line = re.sub(r"^(\s*)(#+)([^ \t\n#])", r"\1\2 \3", line)
            formatted_lines.append(formatted_line)
        else:
            formatted_lines.append(line)

    # Flush buffer
    if table_buffer:
        formatted_lines.extend(format_table(table_buffer))

    return "\n".join(formatted_lines)


def format_table(buffer: list[str]) -> list[str]:
    """
    Align a markdown table.
    """
    if len(buffer) < 2:
        return buffer

    # Check if lines look like a table
    # Parse rows
    rows = []
    for line in buffer:
        # Split by pipe, stripping whitespace from cells
        # We assume leading/trailing pipes exist or imply them
        # Logic: Split by |, strip items.
        # But escaping \| issues... minimal formatter for now.
        # If line doesn't start/end with |, it might be a valid MD table too?
        # Re-enforce | at start/end
        content_line = line.strip()
        if not content_line.startswith("|"):
            content_line = "|" + content_line
        if not content_line.endswith("|") and not content_line.endswith("\\|"):  # rough check
            content_line = content_line + "|"

        # Split
        cells = [c.strip() for c in content_line.strip().split("|")]
        # Because of split, first and last might be empty strings from the surrounding pipes
        if content_line.startswith("|"):
            cells.pop(0)
        if content_line.endswith("|"):
            cells.pop()

        rows.append(cells)

    # Determine max columns
    max_cols = 0
    for row in rows:
        max_cols = max(max_cols, len(row))

    # Pad rows to max_cols
    for row in rows:
        while len(row) < max_cols:
            row.append("")

    # Calculate column widths
    col_widths = [0] * max_cols
    for row_idx, row in enumerate(rows):
        for col_idx, cell in enumerate(row):
            # Don't count separator line dashes for width calculation logic (except min)
            # But we need to know if it IS a separator line
            # Heuristic: Row 1 (0-indexed) is usually separator? NO, Row 1 (second row).
            if row_idx == 1 and all(c.strip(" -:") == "" for c in row):
                continue  # Skip separator for text width
            col_widths[col_idx] = max(col_widths[col_idx], len(cell))

    # Ensure min width?
    col_widths = [max(w, 3) for w in col_widths]

    # Rebuild
    new_rows = []
    for row_idx, row in enumerate(rows):
        new_cells = []
        is_separator = row_idx == 1 and all(c.strip(" -:") == "" for c in row)

        for col_idx, cell in enumerate(row):
            width = col_widths[col_idx]
            if is_separator:
                # Reconstruct separator
                # Check original alignment
                s = cell.strip()
                left = ":" if s.startswith(":") else "-"
                right = ":" if s.endswith(":") else "-"
                # fill
                fill_len = width - (1 if left == ":" else 0) - (1 if right == ":" else 0)
                # Ensure at least one dash
                fill_len = max(fill_len, 1)
                new_cell = (left if left == ":" else "-") + ("-" * fill_len) + (right if right == ":" else "-")
                # Ensure it fits exactly the width if we can (e.g. --- becomes -------)
                # Center pad? usually just fill with dashes.
                # Actually, standard is --- or :--- or ---: or :---:
                # We should pad with - to match width.

                # Let's simplify:
                # just take alignment and fill to match width
                prefix = ":" if s.startswith(":") else ""
                suffix = ":" if s.endswith(":") else ""
                dash_count = max(1, width - len(prefix) - len(suffix))
                new_cell = prefix + ("-" * dash_count) + suffix
                # If it's shorter than width (possible?), pad with -
                if len(new_cell) < width:
                    new_cell = new_cell + ("-" * (width - len(new_cell)))
                new_cells.append(new_cell)
            else:
                new_cells.append(cell.ljust(width))

        new_rows.append("| " + " | ".join(new_cells) + " |")

    return new_rows
