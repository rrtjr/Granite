"""
Backend tests for Datetime Settings and Timezone Functionality

Tests the timezone helpers, frontmatter field updates, and modified date on open.

Run with: pytest tests/test_datetime_settings.py
"""

import shutil
import sys
import tempfile
from datetime import timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from backend.utils import (
    format_datetime_for_frontmatter,
    get_default_user_settings,
    get_ordinal_suffix,
    get_timezone_from_setting,
    update_frontmatter_field,
)


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def temp_settings_file():
    """Create a temporary settings file for testing"""
    temp_dir = tempfile.mkdtemp()
    settings_path = Path(temp_dir) / "test-settings.json"

    yield settings_path

    # Cleanup
    shutil.rmtree(temp_dir)


class TestGetTimezoneFromSetting:
    """Test get_timezone_from_setting function"""

    def test_local_timezone_returns_none(self):
        """Test that 'local' returns None (for local time handling)"""
        result = get_timezone_from_setting("local")
        assert result is None

    def test_utc_timezone_returns_utc(self):
        """Test that 'UTC' returns timezone.utc"""
        result = get_timezone_from_setting("UTC")
        assert result == timezone.utc

    def test_valid_iana_timezone(self):
        """Test that valid IANA timezone names work"""
        result = get_timezone_from_setting("America/New_York")
        assert result is not None
        assert str(result) == "America/New_York"

    def test_invalid_timezone_falls_back_to_utc(self):
        """Test that invalid timezone falls back to UTC"""
        result = get_timezone_from_setting("Invalid/Timezone")
        assert result == timezone.utc

    def test_empty_string_falls_back_to_utc(self):
        """Test that empty string falls back to UTC"""
        result = get_timezone_from_setting("")
        assert result == timezone.utc


class TestFormatDatetimeForFrontmatter:
    """Test format_datetime_for_frontmatter function"""

    def test_returns_correct_format(self):
        """Test that datetime is formatted as 'Saturday 5th April 2025 12:00:00 AM GMT+08:00'"""
        import re

        result = format_datetime_for_frontmatter("local")
        # Should match pattern like "Saturday 5th April 2025 12:00:00 AM GMT+08:00"
        pattern = r"^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th) [A-Z][a-z]+ \d{4} \d{2}:\d{2}:\d{2} (AM|PM) GMT[+-]\d{2}:\d{2}$"
        assert re.match(pattern, result), f"Format mismatch: {result}"

    def test_local_timezone_format(self):
        """Test formatting with local timezone"""
        import re

        result = format_datetime_for_frontmatter("local")
        # Verify it matches the expected format
        pattern = r"^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th) [A-Z][a-z]+ \d{4} \d{2}:\d{2}:\d{2} (AM|PM) GMT[+-]\d{2}:\d{2}$"
        assert re.match(pattern, result), f"Format mismatch: {result}"

    def test_utc_timezone_format(self):
        """Test formatting with UTC timezone"""
        result = format_datetime_for_frontmatter("UTC")
        assert "GMT+00:00" in result

    def test_iana_timezone_format(self):
        """Test formatting with IANA timezone"""
        import re

        result = format_datetime_for_frontmatter("America/New_York")
        pattern = r"^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th) [A-Z][a-z]+ \d{4} \d{2}:\d{2}:\d{2} (AM|PM) GMT[+-]\d{2}:\d{2}$"
        assert re.match(pattern, result), f"Format mismatch: {result}"

    def test_default_is_local(self):
        """Test that default timezone is local"""
        import re

        result = format_datetime_for_frontmatter()
        pattern = r"^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th) [A-Z][a-z]+ \d{4} \d{2}:\d{2}:\d{2} (AM|PM) GMT[+-]\d{2}:\d{2}$"
        assert re.match(pattern, result), f"Format mismatch: {result}"

    def test_ordinal_suffixes(self):
        """Test that ordinal suffixes are correctly applied"""
        assert get_ordinal_suffix(1) == "st"
        assert get_ordinal_suffix(2) == "nd"
        assert get_ordinal_suffix(3) == "rd"
        assert get_ordinal_suffix(4) == "th"
        assert get_ordinal_suffix(11) == "th"
        assert get_ordinal_suffix(12) == "th"
        assert get_ordinal_suffix(13) == "th"
        assert get_ordinal_suffix(21) == "st"
        assert get_ordinal_suffix(22) == "nd"
        assert get_ordinal_suffix(23) == "rd"
        assert get_ordinal_suffix(31) == "st"


class TestUpdateFrontmatterField:
    """Test update_frontmatter_field function"""

    def test_update_existing_field(self):
        """Test updating an existing field in frontmatter"""
        content = """---
type: research
created: 2026-01-01
modified: 2026-01-01
---

# My Note
"""
        result = update_frontmatter_field(content, "modified", "2026-01-17 14:30:45")

        assert "modified: 2026-01-17 14:30:45" in result
        assert "created: 2026-01-01" in result  # Should not be changed

    def test_add_missing_field(self):
        """Test adding a field that doesn't exist in frontmatter"""
        content = """---
type: research
created: 2026-01-01
---

# My Note
"""
        result = update_frontmatter_field(content, "modified", "2026-01-17 14:30:45")

        assert "modified: 2026-01-17 14:30:45" in result
        assert "created: 2026-01-01" in result

    def test_no_frontmatter_returns_unchanged(self):
        """Test that content without frontmatter is returned unchanged"""
        content = """# My Note

Some content here.
"""
        result = update_frontmatter_field(content, "modified", "2026-01-17 14:30:45")

        assert result == content

    def test_malformed_frontmatter_returns_unchanged(self):
        """Test that malformed frontmatter (no closing ---) returns unchanged"""
        content = """---
type: research
created: 2026-01-01

# My Note
"""
        result = update_frontmatter_field(content, "modified", "2026-01-17 14:30:45")

        assert result == content

    def test_empty_frontmatter(self):
        """Test updating empty frontmatter"""
        content = """---
---

# My Note
"""
        result = update_frontmatter_field(content, "modified", "2026-01-17 14:30:45")

        assert "modified: 2026-01-17 14:30:45" in result

    def test_preserves_other_content(self):
        """Test that note content after frontmatter is preserved"""
        content = """---
type: research
modified: 2026-01-01
---

# My Note

This is important content.

## Section 2

More content here.
"""
        result = update_frontmatter_field(content, "modified", "2026-01-17 14:30:45")

        assert "# My Note" in result
        assert "This is important content." in result
        assert "## Section 2" in result
        assert "More content here." in result


class TestDatetimeSettingsDefaults:
    """Test datetime settings in default user settings"""

    def test_datetime_in_default_settings(self):
        """Test that datetime settings are included in defaults"""
        defaults = get_default_user_settings()

        assert "datetime" in defaults
        assert "timezone" in defaults["datetime"]
        assert "updateModifiedOnOpen" in defaults["datetime"]

    def test_default_timezone_is_local(self):
        """Test that default timezone is 'local'"""
        defaults = get_default_user_settings()

        assert defaults["datetime"]["timezone"] == "local"

    def test_default_update_modified_on_open_is_true(self):
        """Test that updateModifiedOnOpen defaults to True"""
        defaults = get_default_user_settings()

        assert defaults["datetime"]["updateModifiedOnOpen"] is True


class TestDatetimeSettingsAPI:
    """Test datetime settings via API"""

    def test_get_datetime_settings(self, client):
        """Test that GET /api/settings/user returns datetime settings"""
        response = client.get("/api/settings/user")

        assert response.status_code == 200
        data = response.json()

        assert "datetime" in data
        assert "timezone" in data["datetime"]
        assert "updateModifiedOnOpen" in data["datetime"]

    def test_update_timezone_setting(self, client):
        """Test updating timezone via API"""
        new_settings = {"datetime": {"timezone": "America/New_York"}}

        response = client.post("/api/settings/user", json=new_settings)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["settings"]["datetime"]["timezone"] == "America/New_York"

    def test_update_modified_on_open_setting(self, client):
        """Test updating updateModifiedOnOpen via API"""
        new_settings = {"datetime": {"updateModifiedOnOpen": False}}

        response = client.post("/api/settings/user", json=new_settings)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["settings"]["datetime"]["updateModifiedOnOpen"] is False

    def test_datetime_settings_persistence(self, client):
        """Test that datetime settings persist across requests"""
        # Set timezone
        client.post("/api/settings/user", json={"datetime": {"timezone": "Europe/London"}})

        # Get settings again
        response = client.get("/api/settings/user")
        data = response.json()

        assert data["datetime"]["timezone"] == "Europe/London"

    def test_datetime_settings_with_other_settings(self, client):
        """Test that datetime settings work alongside other settings"""
        new_settings = {
            "reading": {"width": "narrow"},
            "datetime": {"timezone": "Asia/Tokyo", "updateModifiedOnOpen": True},
        }

        response = client.post("/api/settings/user", json=new_settings)

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["reading"]["width"] == "narrow"
        assert data["settings"]["datetime"]["timezone"] == "Asia/Tokyo"
        assert data["settings"]["datetime"]["updateModifiedOnOpen"] is True


class TestModifiedDateOnOpen:
    """Test that modified date is updated when opening a note"""

    def test_modified_date_updated_on_get_note(self, client):
        """Test that getting a note updates its modified date"""
        # First, create a note with frontmatter
        note_path = "test_modified_date.md"
        initial_content = """---
type: test
created: 2026-01-01 00:00:00
modified: 2026-01-01 00:00:00
---

# Test Note
"""
        # Create the note
        client.post(f"/api/notes/{note_path}", json={"content": initial_content})

        # Get the note (should update modified date)
        response = client.get(f"/api/notes/{note_path}")

        assert response.status_code == 200
        data = response.json()

        # Modified date should be different from the original
        assert "modified: 2026-01-01 00:00:00" not in data["content"]
        assert "modified:" in data["content"]

        # Clean up
        client.delete(f"/api/notes/{note_path}")

    def test_modified_date_respects_setting(self, client):
        """Test that modified date update respects the setting"""
        # Disable updateModifiedOnOpen
        client.post("/api/settings/user", json={"datetime": {"updateModifiedOnOpen": False}})

        # Create a note with frontmatter
        note_path = "test_no_modified_update.md"
        initial_content = """---
type: test
created: 2026-01-01 00:00:00
modified: 2026-01-01 00:00:00
---

# Test Note
"""
        # Create the note
        client.post(f"/api/notes/{note_path}", json={"content": initial_content})

        # Get the note (should NOT update modified date)
        response = client.get(f"/api/notes/{note_path}")

        assert response.status_code == 200
        data = response.json()

        # Modified date should remain unchanged
        assert "modified: 2026-01-01 00:00:00" in data["content"]

        # Clean up
        client.delete(f"/api/notes/{note_path}")

        # Re-enable the setting
        client.post("/api/settings/user", json={"datetime": {"updateModifiedOnOpen": True}})

    def test_note_without_frontmatter_unchanged(self, client):
        """Test that notes without frontmatter are not modified"""
        note_path = "test_no_frontmatter.md"
        initial_content = """# Test Note

This note has no frontmatter.
"""
        # Create the note
        client.post(f"/api/notes/{note_path}", json={"content": initial_content})

        # Get the note
        response = client.get(f"/api/notes/{note_path}")

        assert response.status_code == 200
        data = response.json()

        # Content should be unchanged (no frontmatter to modify)
        assert data["content"] == initial_content

        # Clean up
        client.delete(f"/api/notes/{note_path}")
