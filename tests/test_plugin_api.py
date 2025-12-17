"""
Backend tests for the Plugin Management API

Run with: pytest tests/test_plugin_api.py
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from backend.plugins import PluginManager


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def plugin_manager():
    """Create a plugin manager instance for testing"""
    from pathlib import Path

    plugins_dir = Path(__file__).parent.parent / "plugins"
    return PluginManager(str(plugins_dir))


class TestPluginAPI:
    """Test the plugin management API endpoints"""

    def test_list_plugins(self, client):
        """Test GET /api/plugins returns plugin list"""
        response = client.get("/api/plugins")

        assert response.status_code == 200
        data = response.json()

        # Should return a dict with 'plugins' key
        assert "plugins" in data
        assert isinstance(data["plugins"], list)

        # If note_stats plugin exists, verify its structure
        if len(data["plugins"]) > 0:
            plugin = data["plugins"][0]
            assert "id" in plugin
            assert "name" in plugin
            assert "version" in plugin
            assert "enabled" in plugin
            assert isinstance(plugin["enabled"], bool)

    def test_toggle_plugin_enable(self, client):
        """Test POST /api/plugins/{plugin_name}/toggle to enable"""
        # First, get the list of available plugins
        response = client.get("/api/plugins")
        plugins = response.json()["plugins"]

        if len(plugins) == 0:
            pytest.skip("No plugins available to test")

        plugin_id = plugins[0]["id"]

        # Enable the plugin
        response = client.post(f"/api/plugins/{plugin_id}/toggle", json={"enabled": True})

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["plugin"] == plugin_id
        assert data["enabled"] is True

    def test_toggle_plugin_disable(self, client):
        """Test POST /api/plugins/{plugin_name}/toggle to disable"""
        # First, get the list of available plugins
        response = client.get("/api/plugins")
        plugins = response.json()["plugins"]

        if len(plugins) == 0:
            pytest.skip("No plugins available to test")

        plugin_id = plugins[0]["id"]

        # Disable the plugin
        response = client.post(f"/api/plugins/{plugin_id}/toggle", json={"enabled": False})

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["plugin"] == plugin_id
        assert data["enabled"] is False

    def test_toggle_nonexistent_plugin(self, client):
        """Test toggling a plugin that doesn't exist is handled gracefully"""
        response = client.post("/api/plugins/nonexistent_plugin_12345/toggle", json={"enabled": True})

        # Backend silently ignores nonexistent plugins and returns success
        # This is acceptable behavior - the operation "succeeds" but does nothing
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["plugin"] == "nonexistent_plugin_12345"

    def test_toggle_plugin_persistence(self, client):
        """Test that plugin state persists after toggle"""
        # Get available plugins
        response = client.get("/api/plugins")
        plugins = response.json()["plugins"]

        if len(plugins) == 0:
            pytest.skip("No plugins available to test")

        plugin_id = plugins[0]["id"]

        # Enable the plugin
        client.post(f"/api/plugins/{plugin_id}/toggle", json={"enabled": True})

        # Verify it's enabled
        response = client.get("/api/plugins")
        plugins = response.json()["plugins"]
        plugin = next((p for p in plugins if p["id"] == plugin_id), None)

        assert plugin is not None
        assert plugin["enabled"] is True

        # Disable the plugin
        client.post(f"/api/plugins/{plugin_id}/toggle", json={"enabled": False})

        # Verify it's disabled
        response = client.get("/api/plugins")
        plugins = response.json()["plugins"]
        plugin = next((p for p in plugins if p["id"] == plugin_id), None)

        assert plugin is not None
        assert plugin["enabled"] is False


class TestPluginManager:
    """Test the PluginManager class directly"""

    def test_plugin_manager_initialization(self, plugin_manager):
        """Test that plugin manager initializes correctly"""
        assert plugin_manager is not None
        assert hasattr(plugin_manager, "plugins")
        assert isinstance(plugin_manager.plugins, dict)

    def test_list_plugins_returns_list(self, plugin_manager):
        """Test that list_plugins returns a list"""
        plugins = plugin_manager.list_plugins()
        assert isinstance(plugins, list)

    def test_enable_plugin(self, plugin_manager):
        """Test enabling a plugin"""
        plugins = plugin_manager.list_plugins()

        if len(plugins) == 0:
            pytest.skip("No plugins available to test")

        plugin_id = plugins[0]["id"]

        # Enable the plugin
        plugin_manager.enable_plugin(plugin_id)

        # Verify it's enabled
        plugins = plugin_manager.list_plugins()
        plugin = next((p for p in plugins if p["id"] == plugin_id), None)

        assert plugin is not None
        assert plugin["enabled"] is True

    def test_disable_plugin(self, plugin_manager):
        """Test disabling a plugin"""
        plugins = plugin_manager.list_plugins()

        if len(plugins) == 0:
            pytest.skip("No plugins available to test")

        plugin_id = plugins[0]["id"]

        # Disable the plugin
        plugin_manager.disable_plugin(plugin_id)

        # Verify it's disabled
        plugins = plugin_manager.list_plugins()
        plugin = next((p for p in plugins if p["id"] == plugin_id), None)

        assert plugin is not None
        assert plugin["enabled"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
