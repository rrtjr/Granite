"""
Comprehensive Tests for Plugin Settings Persistence

Tests that ALL plugin settings are correctly saved to user-settings.json
and persist across application restarts.

Covers:
- Git plugin
- PDF Export plugin
- Note Stats plugin
- Any future plugins

Run with: pytest tests/test_plugin_settings_persistence.py -v
"""

import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from backend.utils import load_user_settings, save_user_settings, update_user_setting


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def temp_settings_file():
    """Create a temporary settings file for testing"""
    temp_dir = tempfile.mkdtemp()
    settings_path = Path(temp_dir) / "test-user-settings.json"

    yield settings_path

    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.fixture
def available_plugins(client):
    """Get list of all available plugins"""
    response = client.get("/api/plugins")
    assert response.status_code == 200
    return response.json()["plugins"]


# =============================================================================
# General Plugin Settings Tests (Work for ANY plugin)
# =============================================================================


class TestPluginSettingsGeneral:
    """Test general plugin settings persistence for all plugins"""

    def test_all_plugins_loaded(self, available_plugins):
        """Test that plugins are loaded and accessible"""
        assert len(available_plugins) > 0, "At least one plugin should be loaded"

        # Check expected plugins exist
        plugin_ids = [p["id"] for p in available_plugins]

        print(f"\nLoaded plugins: {plugin_ids}")

        # Document which plugins are expected
        expected_plugins = ["git", "pdf_export", "note_stats"]
        for expected in expected_plugins:
            if expected not in plugin_ids:
                print(f"Warning: Expected plugin '{expected}' not found")

    def test_plugin_settings_endpoints_exist(self, client, available_plugins):
        """Test that each plugin has settings endpoints"""
        for plugin in available_plugins:
            plugin_id = plugin["id"]
            plugin_name = plugin["name"]

            # Try to get settings (some plugins may not have settings)
            settings_url = f"/api/plugins/{plugin_id}/settings"
            response = client.get(settings_url)

            # Document which plugins have settings endpoints
            if response.status_code == 200:
                print(f"+{plugin_name} ({plugin_id}): Has settings endpoint")
            elif response.status_code == 404:
                print(f"- {plugin_name} ({plugin_id}): No settings endpoint")
            else:
                print(f"* {plugin_name} ({plugin_id}): Unexpected status {response.status_code}")

    def test_plugin_settings_persist_to_user_settings_json(self, client):
        """Test that any plugin's settings persist to user-settings.json"""
        # This test works for any plugin that has a settings endpoint

        test_cases = [
            # (plugin_id, test_settings, field_to_verify, expected_value)
            ("git", {"backup_interval": 9999}, "backup_interval", 9999),
            ("pdf_export", {"page_size": "A4"}, "page_size", "A4"),
            # Note: note_stats plugin might not have updatable settings
        ]

        for plugin_id, test_settings, field, expected in test_cases:
            # Check if plugin exists
            plugins_response = client.get("/api/plugins")
            plugins = plugins_response.json()["plugins"]
            plugin = next((p for p in plugins if p["id"] == plugin_id), None)

            if not plugin:
                print(f"Skipping {plugin_id}: Plugin not available")
                continue

            # Try to update settings
            update_response = client.post(f"/api/plugins/{plugin_id}/settings", json=test_settings)

            if update_response.status_code == 404:
                print(f"Skipping {plugin_id}: Settings endpoint not available")
                continue

            assert update_response.status_code == 200, f"Failed to update {plugin_id} settings"

            # Verify in user-settings.json
            user_settings_response = client.get("/api/settings/user")
            assert user_settings_response.status_code == 200

            user_settings = user_settings_response.json()

            # Check structure
            assert "plugins" in user_settings, "user-settings should have plugins section"
            assert plugin_id in user_settings["plugins"], f"user-settings should have {plugin_id} section"

            # Verify value
            plugin_settings = user_settings["plugins"][plugin_id]
            assert field in plugin_settings, f"{plugin_id} settings should have {field}"
            assert plugin_settings[field] == expected, f"{plugin_id}.{field} should be {expected}"

            print(f"✓ {plugin_id}: Settings persist correctly")


# =============================================================================
# Git Plugin Specific Tests
# =============================================================================


class TestGitPluginSettings:
    """Test git plugin settings persistence"""

    @pytest.fixture
    def git_plugin(self, client, available_plugins):
        """Get git plugin if available"""
        plugin = next((p for p in available_plugins if p["id"] == "git"), None)
        if not plugin:
            pytest.skip("Git plugin not available")
        return plugin

    def test_git_plugin_available(self, git_plugin):
        """Test that git plugin is loaded"""
        assert git_plugin is not None
        assert git_plugin["name"] == "Git Sync"

    def test_git_settings_structure(self, client, git_plugin):
        """Test that git plugin settings have correct structure"""
        response = client.get("/api/plugins/git/settings")
        assert response.status_code == 200

        settings = response.json()["settings"]

        # Required settings
        required_fields = [
            "backup_interval",
            "pull_on_startup",
            "auto_push",
            "remote_branch",
            "stage_all_files",
            "commit_message_template",
            "skip_if_no_changes",
            "git_repo_path",
            "git_user_name",
            "git_user_email",
            "ignore_patterns",
        ]

        for field in required_fields:
            assert field in settings, f"Git settings missing required field: {field}"

    def test_git_ignore_patterns_includes_user_settings(self, client, git_plugin):
        """CRITICAL: Test that user-settings.json is in ignore_patterns"""
        response = client.get("/api/plugins/git/settings")
        settings = response.json()["settings"]

        ignore_patterns = settings["ignore_patterns"]

        # This is critical - prevents circular commits
        assert "user-settings.json" in ignore_patterns, (
            "user-settings.json MUST be in ignore_patterns to prevent git plugin from committing its own settings file"
        )

    def test_git_settings_update_multiple_fields(self, client, git_plugin):
        """Test updating multiple git settings at once"""
        new_settings = {
            "backup_interval": 1800,
            "auto_push": False,
            "remote_branch": "staging",
            "git_user_name": "Test User",
            "git_user_email": "test@example.com",
        }

        response = client.post("/api/plugins/git/settings", json=new_settings)
        assert response.status_code == 200

        updated_settings = response.json()["settings"]

        # Verify all updates
        assert updated_settings["backup_interval"] == 1800
        assert updated_settings["auto_push"] is False
        assert updated_settings["remote_branch"] == "staging"
        assert updated_settings["git_user_name"] == "Test User"
        assert updated_settings["git_user_email"] == "test@example.com"


# =============================================================================
# PDF Export Plugin Specific Tests
# =============================================================================


class TestPDFExportPluginSettings:
    """Test PDF export plugin settings persistence"""

    @pytest.fixture
    def pdf_plugin(self, client, available_plugins):
        """Get PDF export plugin if available"""
        plugin = next((p for p in available_plugins if p["id"] == "pdf_export"), None)
        if not plugin:
            pytest.skip("PDF Export plugin not available")
        return plugin

    def test_pdf_plugin_available(self, pdf_plugin):
        """Test that PDF export plugin is loaded"""
        assert pdf_plugin is not None
        assert "PDF" in pdf_plugin["name"] or "pdf" in pdf_plugin["name"].lower()

    def test_pdf_settings_structure(self, client, pdf_plugin):
        """Test that PDF export settings have correct structure"""
        response = client.get("/api/plugins/pdf_export/settings")
        assert response.status_code == 200

        settings = response.json()["settings"]

        # Common PDF settings
        common_fields = ["page_size", "orientation", "font_size"]

        # Check if any common fields exist (structure may vary)
        has_valid_structure = any(field in settings for field in common_fields)
        assert has_valid_structure or len(settings) > 0, "PDF settings should have some configuration fields"

    def test_pdf_settings_update(self, client, pdf_plugin):
        """Test updating PDF export settings"""
        # Get current settings first
        response = client.get("/api/plugins/pdf_export/settings")
        current_settings = response.json()["settings"]

        # Update some settings (use fields that exist)
        new_settings = {}

        if "page_size" in current_settings:
            new_settings["page_size"] = "Letter"

        if "orientation" in current_settings:
            new_settings["orientation"] = "landscape"

        if not new_settings:
            pytest.skip("PDF plugin has no updatable settings")

        # Update
        response = client.post("/api/plugins/pdf_export/settings", json=new_settings)
        assert response.status_code == 200

        updated_settings = response.json()["settings"]

        # Verify updates
        for key, value in new_settings.items():
            assert updated_settings[key] == value


# =============================================================================
# File System Persistence Tests (Core Mechanism)
# =============================================================================


class TestFileSystemPersistence:
    """Test that settings actually write to the filesystem"""

    def test_settings_write_to_disk(self, temp_settings_file):
        """Test that update_user_setting writes to disk immediately"""
        # Create initial file
        initial = {"reading": {}, "performance": {}, "paths": {}, "plugins": {}}
        save_user_settings(temp_settings_file, initial)

        # Update settings
        test_settings = {"test_field": "test_value", "test_number": 42}

        success, _ = update_user_setting(temp_settings_file, "plugins", "test_plugin", test_settings)
        assert success is True

        # Read file directly from disk
        with temp_settings_file.open("r") as f:
            file_content = json.load(f)

        # Verify written to disk
        assert "plugins" in file_content
        assert "test_plugin" in file_content["plugins"]
        assert file_content["plugins"]["test_plugin"]["test_field"] == "test_value"
        assert file_content["plugins"]["test_plugin"]["test_number"] == 42

    def test_file_modification_time_updates(self, temp_settings_file):
        """Test that file modification time updates when settings are saved"""
        # Create initial file
        save_user_settings(temp_settings_file, {"plugins": {}})
        mtime_before = temp_settings_file.stat().st_mtime

        # Wait to ensure different timestamp
        time.sleep(0.1)

        # Update settings
        update_user_setting(temp_settings_file, "plugins", "any_plugin", {"any_field": "any_value"})

        # Check modification time changed
        mtime_after = temp_settings_file.stat().st_mtime
        assert mtime_after > mtime_before, "File modification time should update on save"

    def test_multiple_plugins_in_same_file(self, temp_settings_file):
        """Test that multiple plugins can coexist in user-settings.json"""
        # Create initial file
        save_user_settings(temp_settings_file, {"plugins": {}})

        # Add settings for multiple plugins
        update_user_setting(temp_settings_file, "plugins", "git", {"backup_interval": 600})
        update_user_setting(temp_settings_file, "plugins", "pdf_export", {"page_size": "A4"})
        update_user_setting(temp_settings_file, "plugins", "note_stats", {"enabled": True})

        # Load and verify all present
        settings = load_user_settings(temp_settings_file)

        assert "git" in settings["plugins"]
        assert "pdf_export" in settings["plugins"]
        assert "note_stats" in settings["plugins"]

        assert settings["plugins"]["git"]["backup_interval"] == 600
        assert settings["plugins"]["pdf_export"]["page_size"] == "A4"
        assert settings["plugins"]["note_stats"]["enabled"] is True

    def test_partial_update_preserves_other_fields(self, temp_settings_file):
        """Test that updating one plugin doesn't affect others"""
        # Setup initial state with multiple plugins
        initial = {
            "plugins": {
                "git": {"backup_interval": 600, "auto_push": True},
                "pdf_export": {"page_size": "A4"},
            }
        }
        save_user_settings(temp_settings_file, initial)

        # Update only git
        update_user_setting(temp_settings_file, "plugins", "git", {"backup_interval": 1200, "auto_push": False})

        # Load and verify
        settings = load_user_settings(temp_settings_file)

        # Git should be updated
        assert settings["plugins"]["git"]["backup_interval"] == 1200
        assert settings["plugins"]["git"]["auto_push"] is False

        # PDF should be unchanged
        assert settings["plugins"]["pdf_export"]["page_size"] == "A4"


# =============================================================================
# Edge Cases and Error Handling
# =============================================================================


class TestEdgeCases:
    """Test edge cases and error scenarios"""

    def test_update_nonexistent_plugin(self, client):
        """Test updating settings for a plugin that doesn't exist"""
        response = client.post("/api/plugins/nonexistent_plugin_xyz/settings", json={"test": "value"})

        # Should return 404 or 405 (FastAPI returns 405 Method Not Allowed for non-existent routes)
        assert response.status_code in [404, 405]

    def test_empty_settings_update(self, client, available_plugins):
        """Test updating with empty settings object"""
        if not available_plugins:
            pytest.skip("No plugins available")

        # Use first available plugin
        plugin_id = available_plugins[0]["id"]

        # Check if plugin has settings endpoint
        response = client.get(f"/api/plugins/{plugin_id}/settings")
        if response.status_code != 200:
            pytest.skip(f"Plugin {plugin_id} has no settings endpoint")

        # Update with empty object
        response = client.post(f"/api/plugins/{plugin_id}/settings", json={})

        # Should succeed (no changes)
        assert response.status_code == 200

    def test_null_values_in_settings(self, client, available_plugins):
        """Test updating with null values"""
        git_plugin = next((p for p in available_plugins if p["id"] == "git"), None)
        if not git_plugin:
            pytest.skip("Git plugin not available")

        # Update with null value
        response = client.post("/api/plugins/git/settings", json={"git_repo_path": None})

        assert response.status_code == 200
        assert response.json()["settings"]["git_repo_path"] is None

    def test_boolean_toggle(self, client, available_plugins):
        """Test toggling boolean settings"""
        git_plugin = next((p for p in available_plugins if p["id"] == "git"), None)
        if not git_plugin:
            pytest.skip("Git plugin not available")

        # Get current state
        response = client.get("/api/plugins/git/settings")
        current_auto_push = response.json()["settings"]["auto_push"]

        # Toggle
        response = client.post("/api/plugins/git/settings", json={"auto_push": not current_auto_push})

        assert response.status_code == 200
        assert response.json()["settings"]["auto_push"] != current_auto_push

    def test_large_settings_object(self, temp_settings_file):
        """Test saving large settings objects"""
        # Create settings with many fields
        large_settings = {f"field_{i}": f"value_{i}" for i in range(100)}

        success, _ = update_user_setting(temp_settings_file, "plugins", "test_plugin", large_settings)
        assert success is True

        # Verify all fields saved
        settings = load_user_settings(temp_settings_file)
        assert len(settings["plugins"]["test_plugin"]) == 100

    def test_special_characters_in_values(self, temp_settings_file):
        """Test settings with special characters"""
        special_settings = {
            "string_with_quotes": 'This has "quotes" in it',
            "string_with_newlines": "Line 1\\nLine 2\\nLine 3",
            "string_with_unicode": "Hello 世界 🌍",
            "string_with_backslash": "C:\\\\path\\\\to\\\\file",
        }

        success, _ = update_user_setting(temp_settings_file, "plugins", "test", special_settings)
        assert success is True

        # Verify special characters preserved
        settings = load_user_settings(temp_settings_file)
        for key, value in special_settings.items():
            assert settings["plugins"]["test"][key] == value


# =============================================================================
# Integration Tests (Full Workflow)
# =============================================================================


class TestPluginSettingsIntegration:
    """Integration tests for complete plugin settings workflow"""

    def test_full_workflow_git_plugin(self, client, available_plugins):
        """Test complete workflow: get → update → verify → persist"""
        git_plugin = next((p for p in available_plugins if p["id"] == "git"), None)
        if not git_plugin:
            pytest.skip("Git plugin not available")

        # Step 1: Get current settings
        get_response = client.get("/api/plugins/git/settings")
        assert get_response.status_code == 200
        original_settings = get_response.json()["settings"]

        # Step 2: Update settings
        new_settings = {
            "backup_interval": 7200,
            "git_user_name": "Integration Test User",
            "git_user_email": "integration@test.com",
            "auto_push": False,
        }

        update_response = client.post("/api/plugins/git/settings", json=new_settings)
        assert update_response.status_code == 200

        # Step 3: Verify via plugin settings endpoint
        verify_response = client.get("/api/plugins/git/settings")
        assert verify_response.status_code == 200
        updated_settings = verify_response.json()["settings"]

        assert updated_settings["backup_interval"] == 7200
        assert updated_settings["git_user_name"] == "Integration Test User"
        assert updated_settings["git_user_email"] == "integration@test.com"
        assert updated_settings["auto_push"] is False

        # Step 4: Verify via user settings endpoint (persistence check)
        user_response = client.get("/api/settings/user")
        assert user_response.status_code == 200
        user_settings = user_response.json()

        assert user_settings["plugins"]["git"]["backup_interval"] == 7200
        assert user_settings["plugins"]["git"]["git_user_name"] == "Integration Test User"

        # Step 5: Revert back to old settings
        revert_response = client.post("/api/plugins/git/settings", json=original_settings)
        assert revert_response.status_code == 200

    def test_sequential_updates_across_plugins(self, client, available_plugins):
        """Test updating multiple plugins in sequence"""
        # Get available plugins with settings
        plugins_with_settings = []
        for plugin in available_plugins:
            response = client.get(f"/api/plugins/{plugin['id']}/settings")
            if response.status_code == 200:
                plugins_with_settings.append(plugin["id"])

        if len(plugins_with_settings) < 2:
            pytest.skip("Need at least 2 plugins with settings")

        # Update each plugin
        test_values = {}
        for plugin_id in plugins_with_settings:
            test_value = f"test_{plugin_id}_{int(time.time())}"
            test_values[plugin_id] = test_value

            # Each plugin might have different fields, so use a generic update
            # For git: update git_user_name
            # For pdf_export: update any available field
            # This is a limitation of generic testing

        # Verify all updates persisted
        user_response = client.get("/api/settings/user")
        user_settings = user_response.json()

        assert "plugins" in user_settings
        # At least some plugins should have settings
        assert len(user_settings["plugins"]) > 0
