#!/usr/bin/env python3
"""Ensure files end with a newline."""

import sys
from pathlib import Path


def fix_file(filepath: str) -> bool:
    """Ensure file ends with newline. Returns True if changes were made."""
    try:
        path = Path(filepath)
        content = path.read_bytes()

        if not content:
            return False

        if not content.endswith(b"\n"):
            with path.open("ab") as f:
                f.write(b"\n")
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
