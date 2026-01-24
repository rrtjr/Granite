"""
Pytest configuration and shared fixtures for all tests

This file contains fixtures that are automatically available to all test files.
"""

import json
import shutil
import sys
from pathlib import Path

import pytest

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

    original_settings = None
    if user_settings_path.exists():
        with user_settings_path.open("r") as f:
            original_settings = json.load(f)
        shutil.copy2(user_settings_path, backup_path)
        print(f"\n[conftest] Backed up user-settings.json to {backup_path}")

    yield

    if original_settings is not None:
        with user_settings_path.open("w") as f:
            json.dump(original_settings, f, indent=2)
        print("\n[conftest] Restored original user-settings.json")

        if backup_path.exists():
            backup_path.unlink()
            print("[conftest] Removed backup file")
    else:
        print("\n[conftest] No original settings to restore")


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

    original_settings = None
    if user_settings_path.exists():
        with user_settings_path.open("r") as f:
            original_settings = json.load(f)

    yield

    if original_settings is not None:
        with user_settings_path.open("w") as f:
            json.dump(original_settings, f, indent=2)
