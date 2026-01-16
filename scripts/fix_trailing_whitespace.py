#!/usr/bin/env python3
"""Fix trailing whitespace in files."""

import sys
from pathlib import Path


def fix_file(filepath: str) -> bool:
    """Fix trailing whitespace in a file. Returns True if changes were made."""
    try:
        path = Path(filepath)
        original = path.read_bytes()

        # Process lines, stripping trailing whitespace but preserving line endings
        lines = original.decode("utf-8", errors="replace").splitlines(keepends=True)
        fixed_lines = []
        for line in lines:
            # Strip trailing whitespace but keep the newline
            if line.endswith("\r\n"):
                fixed_lines.append(line.rstrip(" \t\r\n") + "\r\n")
            elif line.endswith("\n"):
                fixed_lines.append(line.rstrip(" \t\n") + "\n")
            elif line.endswith("\r"):
                fixed_lines.append(line.rstrip(" \t\r") + "\r")
            else:
                fixed_lines.append(line.rstrip(" \t"))

        fixed = "".join(fixed_lines).encode("utf-8")

        if fixed != original:
            path.write_bytes(fixed)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)
        return False


def main() -> int:
    """Main entry point."""
    changed = False
    for filepath in sys.argv[1:]:
        if fix_file(filepath):
            print(f"Fixed: {filepath}")
            changed = True
    return 1 if changed else 0


if __name__ == "__main__":
    sys.exit(main())
