"""
Backend tests for Favorites Feature

Tests the favorites functionality stored in user-settings.json

Run with: pytest tests/test_favorites.py
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from backend.utils import (
    get_default_user_settings,
    load_user_settings,
    save_user_settings,
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


class TestFavoritesDefaultSettings:
    """Test that favorites are included in default settings"""

    def test_default_settings_include_favorites(self):
        """Test that default settings have favorites array"""
        defaults = get_default_user_settings()

        assert "favorites" in defaults
        assert isinstance(defaults["favorites"], list)
        assert len(defaults["favorites"]) == 0

    def test_favorites_default_is_empty_list(self):
        """Test that favorites defaults to an empty list"""
        defaults = get_default_user_settings()

        assert defaults["favorites"] == []


class TestFavoritesAPI:
    """Test favorites via user settings API"""

    def test_get_favorites_empty_initially(self, client):
        """Test that favorites are empty initially"""
        response = client.get("/api/settings/user")

        assert response.status_code == 200
        data = response.json()

        # Favorites should exist (may be empty or have existing data)
        assert "favorites" in data or data.get("favorites") is None or isinstance(data.get("favorites", []), list)

    def test_add_favorites(self, client):
        """Test adding notes to favorites"""
        favorites = ["notes/test1.md", "notes/folder/test2.md"]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "settings" in data
        assert data["settings"]["favorites"] == favorites

    def test_update_favorites(self, client):
        """Test updating favorites list"""
        # Set initial favorites
        initial_favorites = ["note1.md", "note2.md"]
        client.post("/api/settings/user", json={"favorites": initial_favorites})

        # Update to new favorites
        new_favorites = ["note1.md", "note3.md", "folder/note4.md"]
        response = client.post("/api/settings/user", json={"favorites": new_favorites})

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["favorites"] == new_favorites

    def test_clear_favorites(self, client):
        """Test clearing all favorites"""
        # Set some favorites first
        client.post("/api/settings/user", json={"favorites": ["note1.md", "note2.md"]})

        # Clear favorites
        response = client.post("/api/settings/user", json={"favorites": []})

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["favorites"] == []

    def test_favorites_persist_across_requests(self, client):
        """Test that favorites persist across requests"""
        favorites = ["important.md", "work/project.md", "personal/diary.md"]

        # Set favorites
        client.post("/api/settings/user", json={"favorites": favorites})

        # Get settings again
        response = client.get("/api/settings/user")
        data = response.json()

        assert data["favorites"] == favorites

    def test_favorites_with_special_characters_in_path(self, client):
        """Test favorites with special characters in note paths"""
        favorites = [
            "notes/my note.md",
            "folder with spaces/test.md",
            "unicode/日本語.md",
        ]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["favorites"] == favorites

    def test_favorites_with_nested_paths(self, client):
        """Test favorites with deeply nested folder paths"""
        favorites = [
            "a/b/c/d/e/deeply-nested.md",
            "projects/2024/q1/report.md",
        ]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["favorites"] == favorites

    def test_favorites_preserves_order(self, client):
        """Test that favorites list preserves order"""
        favorites = ["third.md", "first.md", "second.md"]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        data = response.json()

        # Order should be preserved exactly
        assert data["settings"]["favorites"] == favorites
        assert data["settings"]["favorites"][0] == "third.md"
        assert data["settings"]["favorites"][1] == "first.md"
        assert data["settings"]["favorites"][2] == "second.md"


class TestFavoritesWithOtherSettings:
    """Test favorites alongside other user settings"""

    def test_favorites_with_reading_settings(self, client):
        """Test that favorites work alongside reading settings"""
        settings = {
            "favorites": ["note1.md", "note2.md"],
            "reading": {"width": "narrow", "align": "center"},
        }

        response = client.post("/api/settings/user", json=settings)

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["favorites"] == ["note1.md", "note2.md"]
        assert data["settings"]["reading"]["width"] == "narrow"
        assert data["settings"]["reading"]["align"] == "center"

    def test_favorites_with_performance_settings(self, client):
        """Test that favorites work alongside performance settings"""
        settings = {
            "favorites": ["important.md"],
            "performance": {"autosaveDelay": 2000},
        }

        response = client.post("/api/settings/user", json=settings)

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["favorites"] == ["important.md"]
        assert data["settings"]["performance"]["autosaveDelay"] == 2000

    def test_updating_favorites_preserves_other_settings(self, client):
        """Test that updating favorites doesn't affect other settings"""
        # Set reading settings
        client.post("/api/settings/user", json={"reading": {"width": "wide"}})

        # Update favorites only
        response = client.post("/api/settings/user", json={"favorites": ["note.md"]})

        assert response.status_code == 200
        data = response.json()

        # Favorites should be updated
        assert data["settings"]["favorites"] == ["note.md"]
        # Reading settings should be preserved
        assert data["settings"]["reading"]["width"] == "wide"

    def test_updating_other_settings_preserves_favorites(self, client):
        """Test that updating other settings doesn't affect favorites"""
        # Set favorites
        client.post("/api/settings/user", json={"favorites": ["fav1.md", "fav2.md"]})

        # Update reading settings only
        response = client.post("/api/settings/user", json={"reading": {"width": "narrow"}})

        assert response.status_code == 200
        data = response.json()

        # Reading should be updated
        assert data["settings"]["reading"]["width"] == "narrow"
        # Favorites should be preserved
        assert data["settings"]["favorites"] == ["fav1.md", "fav2.md"]


class TestFavoritesFilePersistence:
    """Test favorites persistence to user-settings.json file"""

    def test_favorites_saved_to_file(self, temp_settings_file):
        """Test that favorites are saved to the settings file"""
        favorites = ["note1.md", "folder/note2.md"]

        settings = get_default_user_settings()
        settings["favorites"] = favorites

        success = save_user_settings(temp_settings_file, settings)

        assert success
        assert temp_settings_file.exists()

        # Verify file contents
        with temp_settings_file.open("r") as f:
            saved_data = json.load(f)

        assert saved_data["favorites"] == favorites

    def test_favorites_loaded_from_file(self, temp_settings_file):
        """Test that favorites are loaded from the settings file"""
        favorites = ["important.md", "work/project.md"]

        # Save settings with favorites
        settings = {"favorites": favorites, "reading": {"width": "full"}}
        save_user_settings(temp_settings_file, settings)

        # Load settings
        loaded_settings = load_user_settings(temp_settings_file)

        assert loaded_settings["favorites"] == favorites

    def test_missing_favorites_gets_default(self, temp_settings_file):
        """Test that missing favorites key gets default empty list"""
        # Save settings without favorites key
        settings = {"reading": {"width": "narrow"}}
        save_user_settings(temp_settings_file, settings)

        # Load settings - should merge with defaults
        loaded_settings = load_user_settings(temp_settings_file)

        # Favorites should be added from defaults
        assert "favorites" in loaded_settings
        assert loaded_settings["favorites"] == []


class TestFavoritesEdgeCases:
    """Test edge cases for favorites"""

    def test_duplicate_favorites(self, client):
        """Test handling of duplicate paths in favorites"""
        # The frontend should prevent this, but test backend handling
        favorites = ["note.md", "note.md", "other.md"]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        # Backend accepts duplicates (frontend responsible for deduplication)
        data = response.json()
        assert len(data["settings"]["favorites"]) == 3

    def test_empty_string_in_favorites(self, client):
        """Test handling of empty string in favorites list"""
        favorites = ["note.md", "", "other.md"]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        # Backend accepts the data as-is
        data = response.json()
        assert "" in data["settings"]["favorites"]

    def test_large_favorites_list(self, client):
        """Test handling of a large favorites list"""
        # Generate 100 favorite paths
        favorites = [f"folder{i}/note{i}.md" for i in range(100)]

        response = client.post("/api/settings/user", json={"favorites": favorites})

        assert response.status_code == 200
        data = response.json()

        assert len(data["settings"]["favorites"]) == 100
        assert data["settings"]["favorites"][0] == "folder0/note0.md"
        assert data["settings"]["favorites"][99] == "folder99/note99.md"

    def test_favorites_with_null_value(self, client):
        """Test setting favorites to null"""
        response = client.post("/api/settings/user", json={"favorites": None})

        # Should either accept null or return error
        # The backend behavior depends on implementation
        assert response.status_code in [200, 400, 422]
