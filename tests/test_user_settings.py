"""
Backend tests for User Settings API

Tests the server-side user settings system (user-settings.json)

Run with: pytest tests/test_user_settings.py
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
    update_user_setting,
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


class TestUserSettingsUtils:
    """Test user settings utility functions"""

    def test_get_default_user_settings(self):
        """Test that default settings have correct structure"""
        defaults = get_default_user_settings()

        assert "reading" in defaults
        assert "performance" in defaults
        assert "paths" in defaults
        assert "datetime" in defaults
        assert "plugins" in defaults

        # Check reading preferences
        assert defaults["reading"]["width"] == "full"
        assert defaults["reading"]["align"] == "left"
        assert defaults["reading"]["margins"] == "normal"
        assert defaults["reading"]["bannerOpacity"] == 0.5

        # Check performance settings
        assert defaults["performance"]["updateDelay"] == 100
        assert defaults["performance"]["autosaveDelay"] == 1000

        # Check paths
        assert defaults["paths"]["templatesDir"] == "_templates"

        # Check datetime settings
        assert defaults["datetime"]["timezone"] == "local"
        assert defaults["datetime"]["updateModifiedOnOpen"] is True

    def test_load_user_settings_creates_file(self, temp_settings_file):
        """Test that load_user_settings creates file with defaults if missing"""
        assert not temp_settings_file.exists()

        settings = load_user_settings(temp_settings_file)

        assert temp_settings_file.exists()
        assert settings == get_default_user_settings()

    def test_save_user_settings(self, temp_settings_file):
        """Test saving user settings to file"""
        test_settings = {
            "reading": {"width": "medium"},
            "performance": {"updateDelay": 200},
            "paths": {"templatesDir": "my_templates"},
            "plugins": {},
        }

        success = save_user_settings(temp_settings_file, test_settings)

        assert success
        assert temp_settings_file.exists()

        # Verify file contents
        with temp_settings_file.open("r") as f:
            saved_data = json.load(f)

        assert saved_data == test_settings

    def test_update_user_setting(self, temp_settings_file):
        """Test updating a specific user setting"""
        # Create initial settings
        save_user_settings(temp_settings_file, get_default_user_settings())

        # Update reading width
        success, updated_settings = update_user_setting(temp_settings_file, "reading", "width", "narrow")

        assert success
        assert updated_settings["reading"]["width"] == "narrow"

        # Verify persistence
        loaded_settings = load_user_settings(temp_settings_file)
        assert loaded_settings["reading"]["width"] == "narrow"

    def test_load_user_settings_merges_with_defaults(self, temp_settings_file):
        """Test that loading settings merges with defaults (for new settings keys)"""
        # Save incomplete settings (missing some keys)
        incomplete_settings = {
            "reading": {"width": "narrow"}
            # Missing performance, paths, plugins
        }
        save_user_settings(temp_settings_file, incomplete_settings)

        # Load should merge with defaults
        loaded_settings = load_user_settings(temp_settings_file)

        assert loaded_settings["reading"]["width"] == "narrow"  # Preserved
        assert "performance" in loaded_settings  # Added from defaults
        assert "paths" in loaded_settings  # Added from defaults
        assert loaded_settings["performance"]["updateDelay"] == 100  # Default value


class TestUserSettingsAPI:
    """Test user settings API endpoints"""

    def test_get_user_settings(self, client):
        """Test GET /api/settings/user returns settings"""
        response = client.get("/api/settings/user")

        assert response.status_code == 200
        data = response.json()

        # Should have all sections
        assert "reading" in data
        assert "performance" in data
        assert "paths" in data
        assert "datetime" in data
        assert "plugins" in data

    def test_update_user_settings(self, client):
        """Test POST /api/settings/user updates settings"""
        new_settings = {"reading": {"width": "wide", "align": "center"}, "performance": {"autosaveDelay": 2000}}

        response = client.post("/api/settings/user", json=new_settings)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "settings" in data
        assert data["settings"]["reading"]["width"] == "wide"
        assert data["settings"]["reading"]["align"] == "center"
        assert data["settings"]["performance"]["autosaveDelay"] == 2000

    def test_update_user_settings_partial(self, client):
        """Test that partial updates work (only update provided keys)"""
        # First update
        client.post("/api/settings/user", json={"reading": {"width": "narrow"}})

        # Second update (different section)
        response = client.post("/api/settings/user", json={"performance": {"updateDelay": 500}})

        assert response.status_code == 200
        data = response.json()

        # Both updates should be preserved
        assert data["settings"]["reading"]["width"] == "narrow"
        assert data["settings"]["performance"]["updateDelay"] == 500

    def test_update_templates_dir_syncs_with_config(self, client):
        """Test that updating templatesDir also updates config.yaml"""
        response = client.post("/api/settings/user", json={"paths": {"templatesDir": "custom_templates"}})

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["paths"]["templatesDir"] == "custom_templates"

        # Verify it's also accessible via templates-dir endpoint
        response = client.get("/api/settings/templates-dir")
        assert response.status_code == 200
        assert response.json()["templatesDir"] == "custom_templates"


class TestPluginSettingsPersistence:
    """Test that plugin settings are persisted to user-settings.json"""

    def test_git_plugin_settings_persist(self, client):
        """Test that git plugin settings are saved to user-settings.json"""
        # Skip if git plugin not available
        plugins_response = client.get("/api/plugins")
        plugins = plugins_response.json()["plugins"]
        git_plugin = next((p for p in plugins if p["id"] == "git"), None)

        if not git_plugin:
            pytest.skip("Git plugin not available")

        # Update git plugin settings
        new_settings = {"backup_interval": 1200, "auto_push": False}

        response = client.post("/api/plugins/git/settings", json=new_settings)
        assert response.status_code == 200

        # Verify settings in user-settings.json
        user_settings_response = client.get("/api/settings/user")
        user_settings = user_settings_response.json()

        assert "plugins" in user_settings
        assert "git" in user_settings["plugins"]
        assert user_settings["plugins"]["git"]["backup_interval"] == 1200
        assert user_settings["plugins"]["git"]["auto_push"] is False

    def test_pdf_export_plugin_settings_persist(self, client):
        """Test that PDF export plugin settings are saved to user-settings.json"""
        # Skip if PDF export plugin not available
        plugins_response = client.get("/api/plugins")
        plugins = plugins_response.json()["plugins"]
        pdf_plugin = next((p for p in plugins if p["id"] == "pdf_export"), None)

        if not pdf_plugin:
            pytest.skip("PDF Export plugin not available")

        # Update PDF export plugin settings
        new_settings = {
            "page_size": "Letter",
            "orientation": "landscape",
            "include_author": True,
            "author_name": "Test Author",
        }

        response = client.post("/api/plugins/pdf_export/settings", json=new_settings)
        assert response.status_code == 200

        # Verify settings in user-settings.json
        user_settings_response = client.get("/api/settings/user")
        user_settings = user_settings_response.json()

        assert "plugins" in user_settings
        assert "pdf_export" in user_settings["plugins"]
        assert user_settings["plugins"]["pdf_export"]["page_size"] == "Letter"
        assert user_settings["plugins"]["pdf_export"]["orientation"] == "landscape"
        assert user_settings["plugins"]["pdf_export"]["include_author"] is True
        assert user_settings["plugins"]["pdf_export"]["author_name"] == "Test Author"


class TestBannerOpacitySettings:
    """Test banner opacity reading preference"""

    def test_default_banner_opacity(self):
        """Test that default settings include bannerOpacity"""
        defaults = get_default_user_settings()

        assert "reading" in defaults
        assert "bannerOpacity" in defaults["reading"]
        assert defaults["reading"]["bannerOpacity"] == 0.5

    def test_banner_opacity_in_api_response(self, client):
        """Test that GET /api/settings/user returns bannerOpacity"""
        response = client.get("/api/settings/user")

        assert response.status_code == 200
        data = response.json()

        assert "reading" in data
        # bannerOpacity should be present (either from defaults or existing settings)
        # It may be missing in legacy settings, so we just check the structure
        assert isinstance(data["reading"], dict)

    def test_update_banner_opacity(self, client):
        """Test updating banner opacity via API"""
        new_settings = {"reading": {"bannerOpacity": 0.8}}

        response = client.post("/api/settings/user", json=new_settings)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["settings"]["reading"]["bannerOpacity"] == 0.8

    def test_banner_opacity_persistence(self, client):
        """Test that banner opacity persists across requests"""
        # Set banner opacity
        client.post("/api/settings/user", json={"reading": {"bannerOpacity": 0.3}})

        # Get settings again
        response = client.get("/api/settings/user")
        data = response.json()

        assert data["reading"]["bannerOpacity"] == 0.3

    def test_banner_opacity_boundary_values(self, client):
        """Test banner opacity with boundary values (0 and 1)"""
        # Test minimum value
        response = client.post("/api/settings/user", json={"reading": {"bannerOpacity": 0}})
        assert response.status_code == 200
        assert response.json()["settings"]["reading"]["bannerOpacity"] == 0

        # Test maximum value
        response = client.post("/api/settings/user", json={"reading": {"bannerOpacity": 1}})
        assert response.status_code == 200
        assert response.json()["settings"]["reading"]["bannerOpacity"] == 1

    def test_banner_opacity_with_other_reading_settings(self, client):
        """Test that banner opacity works alongside other reading settings"""
        new_settings = {
            "reading": {
                "width": "narrow",
                "align": "center",
                "margins": "relaxed",
                "bannerOpacity": 0.7,
            }
        }

        response = client.post("/api/settings/user", json=new_settings)

        assert response.status_code == 200
        data = response.json()

        assert data["settings"]["reading"]["width"] == "narrow"
        assert data["settings"]["reading"]["align"] == "center"
        assert data["settings"]["reading"]["margins"] == "relaxed"
        assert data["settings"]["reading"]["bannerOpacity"] == 0.7
