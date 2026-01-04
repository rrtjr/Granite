"""
Pytest configuration and shared fixtures for all tests

This file contains fixtures that are automatically available to all test files.
"""

import json
import shutil
import sys
from pathlib import Path

import pytest

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture(scope="session", autouse=True)
def preserve_user_settings():
    """
    Session-scoped fixture to preserve user-settings.json across all tests.

    This fixture automatically:
    1. Backs up the original user-settings.json before any tests run
    2. Restores it after all tests complete

    This ensures tests don't permanently modify the user's actual configuration.
    """
    user_settings_path = Path(__file__).parent.parent / "user-settings.json"
    backup_path = Path(__file__).parent.parent / "user-settings.json.backup"

    # Backup original settings if file exists
    original_settings = None
    if user_settings_path.exists():
        with user_settings_path.open("r") as f:
            original_settings = json.load(f)
        # Also create a physical backup
        shutil.copy2(user_settings_path, backup_path)
        print(f"\n[conftest] Backed up user-settings.json to {backup_path}")

    # Let tests run
    yield

    # Restore original settings after all tests complete
    if original_settings is not None:
        with user_settings_path.open("w") as f:
            json.dump(original_settings, f, indent=2)
        print(f"\n[conftest] Restored original user-settings.json")

        # Remove backup file
        if backup_path.exists():
            backup_path.unlink()
            print(f"[conftest] Removed backup file")
    else:
        print(f"\n[conftest] No original settings to restore")


@pytest.fixture(scope="function")
def preserve_user_settings_per_test():
    """
    Function-scoped fixture to preserve user-settings.json for a single test.

    Use this fixture explicitly in tests that modify settings and want them
    restored immediately after the test (not just at session end).

    Usage:
        def test_something(preserve_user_settings_per_test):
            # modify settings
            # they will be restored after this test
    """
    user_settings_path = Path(__file__).parent.parent / "user-settings.json"

    # Backup current settings
    original_settings = None
    if user_settings_path.exists():
        with user_settings_path.open("r") as f:
            original_settings = json.load(f)

    # Let test run
    yield

    # Restore settings after test
    if original_settings is not None:
        with user_settings_path.open("w") as f:
            json.dump(original_settings, f, indent=2)
