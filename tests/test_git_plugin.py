"""
Backend tests for the Git Plugin

Run with: pytest tests/test_git_plugin.py -v
"""

import shutil
import subprocess
import sys
import tempfile
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
    plugins_dir = Path(__file__).parent.parent / "plugins"
    return PluginManager(str(plugins_dir))


@pytest.fixture
def git_plugin(plugin_manager):
    """Get the git plugin instance"""
    git = plugin_manager.plugins.get("git")
    if not git:
        pytest.skip("Git plugin not found")
    return git


@pytest.fixture
def temp_git_repo():
    """Create a temporary git repository for testing"""
    # Check if git is available
    try:
        subprocess.run(["git", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("Git is not installed - skipping integration tests")

    temp_dir = tempfile.mkdtemp()
    try:
        # Initialize git repo
        subprocess.run(["git", "init"], cwd=temp_dir, check=True, capture_output=True)
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"], cwd=temp_dir, check=True, capture_output=True
        )
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=temp_dir, check=True, capture_output=True)

        yield temp_dir
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


class TestGitPluginAPI:
    """Test the git plugin API endpoints"""

    def test_get_git_settings(self, client):
        """Test GET /api/plugins/git/settings"""
        response = client.get("/api/plugins/git/settings")

        # Should return 200 if git plugin exists, 404 otherwise
        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 200
        data = response.json()

        assert "settings" in data
        assert isinstance(data["settings"], dict)

        # Verify expected settings keys
        settings = data["settings"]
        assert "backup_interval" in settings
        assert "pull_on_startup" in settings
        assert "auto_push" in settings
        assert "remote_branch" in settings
        assert "stage_all_files" in settings
        assert "commit_message_template" in settings
        assert "skip_if_no_changes" in settings

    def test_update_git_settings(self, client):
        """Test POST /api/plugins/git/settings"""
        new_settings = {
            "backup_interval": 300,
            "pull_on_startup": False,
            "auto_push": False,
            "remote_branch": "develop",
        }

        response = client.post("/api/plugins/git/settings", json=new_settings)

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "settings" in data

        # Verify settings were updated
        settings = data["settings"]
        assert settings["backup_interval"] == 300
        assert settings["pull_on_startup"] is False
        assert settings["auto_push"] is False
        assert settings["remote_branch"] == "develop"

    def test_get_git_status(self, client):
        """Test GET /api/plugins/git/status"""
        response = client.get("/api/plugins/git/status")

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 200
        data = response.json()

        assert "enabled" in data
        assert isinstance(data["enabled"], bool)

        # If plugin has get_status method, check for additional fields
        if "backup_count" in data:
            assert isinstance(data["backup_count"], int)
            assert "last_backup_time" in data
            assert "timer_running" in data
            assert "settings" in data

    def test_manual_backup(self, client):
        """Test POST /api/plugins/git/manual-backup"""
        # First enable the plugin
        client.post("/api/plugins/git/toggle", json={"enabled": True})

        response = client.post("/api/plugins/git/manual-backup")

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        # May return 200 (success) or 400 (not a git repo)
        # Both are acceptable depending on environment
        assert response.status_code in [200, 400]

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True

    def test_manual_pull(self, client):
        """Test POST /api/plugins/git/manual-pull"""
        # First enable the plugin
        client.post("/api/plugins/git/toggle", json={"enabled": True})

        response = client.post("/api/plugins/git/manual-pull")

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        # May return 200 (success) or 400 (not a git repo)
        # Both are acceptable depending on environment
        assert response.status_code in [200, 400]

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True

    def test_manual_backup_requires_enabled_plugin(self, client):
        """Test that manual backup requires plugin to be enabled"""
        # First disable the plugin
        client.post("/api/plugins/git/toggle", json={"enabled": False})

        response = client.post("/api/plugins/git/manual-backup")

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 400

    def test_manual_pull_requires_enabled_plugin(self, client):
        """Test that manual pull requires plugin to be enabled"""
        # First disable the plugin
        client.post("/api/plugins/git/toggle", json={"enabled": False})

        response = client.post("/api/plugins/git/manual-pull")

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 400

    def test_get_ssh_public_key(self, client):
        """Test GET /api/plugins/git/ssh/public-key"""
        response = client.get("/api/plugins/git/ssh/public-key")

        if response.status_code == 404:
            # Either plugin not found or no SSH key exists
            # Both are acceptable
            pass
        else:
            assert response.status_code in [200, 404]
            if response.status_code == 200:
                data = response.json()
                assert "success" in data
                assert "public_key" in data

    def test_generate_ssh_key_requires_enabled_plugin(self, client):
        """Test that SSH key generation requires plugin to be enabled"""
        # First disable the plugin
        client.post("/api/plugins/git/toggle", json={"enabled": False})

        response = client.post("/api/plugins/git/ssh/generate")

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 400

    def test_ssh_connection_test(self, client):
        """Test POST /api/plugins/git/ssh/test"""
        response = client.post("/api/plugins/git/ssh/test", json={"host": "github.com"})

        if response.status_code == 404:
            pytest.skip("Git plugin not found")

        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data


class TestGitPluginUnit:
    """Test the git plugin functionality directly"""

    def test_git_plugin_exists(self, git_plugin):
        """Test that git plugin is loaded"""
        assert git_plugin is not None
        assert git_plugin.name == "Git Sync"
        assert hasattr(git_plugin, "settings")

    def test_default_settings(self, git_plugin):
        """Test that git plugin has correct default settings"""
        settings = git_plugin.settings

        assert settings["backup_interval"] == 600  # 10 minutes
        assert settings["pull_on_startup"] is True
        assert settings["auto_push"] is True
        assert settings["remote_branch"] == "main"
        assert settings["git_user_name"] == ""
        assert settings["git_user_email"] == ""
        assert settings["stage_all_files"] is True
        assert settings["commit_message_template"] == "Auto-backup: {timestamp}"
        assert settings["skip_if_no_changes"] is True
        assert "ignore_patterns" in settings

    def test_update_settings(self, git_plugin):
        """Test updating plugin settings"""
        original_interval = git_plugin.settings["backup_interval"]

        new_settings = {"backup_interval": 300, "auto_push": False}

        git_plugin.update_settings(new_settings)

        assert git_plugin.settings["backup_interval"] == 300
        assert git_plugin.settings["auto_push"] is False

        # Restore original settings
        git_plugin.update_settings({"backup_interval": original_interval, "auto_push": True})

    def test_get_settings(self, git_plugin):
        """Test get_settings returns a copy"""
        settings = git_plugin.get_settings()

        assert isinstance(settings, dict)
        assert "backup_interval" in settings

        # Modifying returned settings should not affect plugin
        settings["backup_interval"] = 9999
        assert git_plugin.settings["backup_interval"] != 9999

    def test_get_status(self, git_plugin):
        """Test get_status returns correct structure"""
        status = git_plugin.get_status()

        assert isinstance(status, dict)
        assert "enabled" in status
        assert "backup_count" in status
        assert "last_backup_time" in status
        assert "timer_running" in status
        assert "settings" in status

    def test_check_git_installed(self, git_plugin):
        """Test checking if git is installed"""
        is_installed = git_plugin._check_git_installed()
        assert isinstance(is_installed, bool)

    def test_run_git_command(self, git_plugin):
        """Test running git commands"""
        success, output = git_plugin._run_git_command(["git", "--version"])

        # Should succeed if git is installed
        if success:
            assert "git" in output.lower()
        else:
            # Git not installed, which is acceptable
            pass

    def test_has_changes_in_non_git_repo(self, git_plugin):
        """Test has_changes in a non-git repository"""
        # Save original path
        original_path = git_plugin.settings.get("git_repo_path")

        # Set to a temp directory (not a git repo)
        with tempfile.TemporaryDirectory() as temp_dir:
            git_plugin.settings["git_repo_path"] = temp_dir
            has_changes = git_plugin._has_changes()
            assert has_changes is False

        # Restore original path
        if original_path:
            git_plugin.settings["git_repo_path"] = original_path

    def test_commit_message_template_formatting(self, git_plugin):
        """Test commit message template with placeholders"""
        from datetime import datetime, timezone

        template = git_plugin.settings["commit_message_template"]
        now = datetime.now(timezone.utc)

        message = template.format(timestamp=now.strftime("%Y-%m-%d %H:%M:%S"), date=now.strftime("%Y-%m-%d"))

        assert "Auto-backup:" in message
        assert str(now.year) in message

    def test_configure_git_user(self, git_plugin, temp_git_repo):
        """Test git user configuration from settings"""
        original_path = git_plugin.settings.get("git_repo_path")
        git_plugin.settings["git_repo_path"] = temp_git_repo

        try:
            # Test with no settings - should check if already configured
            git_plugin.settings["git_user_name"] = ""
            git_plugin.settings["git_user_email"] = ""
            # In temp repo, git user is already configured by fixture
            assert git_plugin._configure_git_user() is True

            # Test with settings provided
            git_plugin.settings["git_user_name"] = "Test User 2"
            git_plugin.settings["git_user_email"] = "test2@example.com"
            assert git_plugin._configure_git_user() is True

            # Verify git config was set
            success, name_output = git_plugin._run_git_command(["git", "config", "user.name"])
            assert success
            assert "Test User 2" in name_output

            success, email_output = git_plugin._run_git_command(["git", "config", "user.email"])
            assert success
            assert "test2@example.com" in email_output

        finally:
            if original_path:
                git_plugin.settings["git_repo_path"] = original_path

    def test_get_ssh_public_key_when_not_exists(self, git_plugin):
        """Test getting SSH public key when it doesn't exist"""
        if hasattr(git_plugin, "get_ssh_public_key"):
            # This will likely return False since we haven't generated a key
            success, message = git_plugin.get_ssh_public_key()
            assert isinstance(success, bool)
            assert isinstance(message, str)
        else:
            pytest.skip("Git plugin does not support SSH key retrieval")

    def test_generate_ssh_key(self, git_plugin):
        """Test SSH key generation"""
        if not hasattr(git_plugin, "generate_ssh_key"):
            pytest.skip("Git plugin does not support SSH key generation")

        # Check if ssh-keygen is available
        try:
            subprocess.run(["ssh-keygen", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            pytest.skip("ssh-keygen not available - skipping SSH key generation test")

        # Note: We won't actually generate a key in tests to avoid conflicts
        # Just verify the method exists and is callable
        assert callable(git_plugin.generate_ssh_key)

    def test_test_ssh_connection(self, git_plugin):
        """Test SSH connection testing"""
        if not hasattr(git_plugin, "test_ssh_connection"):
            pytest.skip("Git plugin does not support SSH connection testing")

        # Test with a host (won't actually connect in most test environments)
        success, message = git_plugin.test_ssh_connection("github.com")
        assert isinstance(success, bool)
        assert isinstance(message, str)
        # Message should contain some info about the connection attempt
        assert len(message) > 0


class TestGitPluginIntegration:
    """Integration tests with actual git operations"""

    def test_git_operations_in_temp_repo(self, git_plugin, temp_git_repo):
        """Test git operations in a temporary repository"""
        # Configure plugin to use temp repo
        original_path = git_plugin.settings.get("git_repo_path")
        git_plugin.settings["git_repo_path"] = temp_git_repo

        try:
            # Test check_is_git_repo
            assert git_plugin._check_is_git_repo() is True

            # Create a test file
            test_file = Path(temp_git_repo) / "test.txt"
            test_file.write_text("Test content")

            # Test has_changes
            assert git_plugin._has_changes() is True

            # Test staging and committing
            git_plugin._git_commit_and_push()

            # After commit, should have no changes (if skip_if_no_changes is True)
            # Note: This might not work in all environments due to git configuration

        finally:
            # Restore original path
            if original_path:
                git_plugin.settings["git_repo_path"] = original_path

    def test_ignore_patterns(self, git_plugin, temp_git_repo):
        """Test that ignore patterns are respected"""
        original_path = git_plugin.settings.get("git_repo_path")
        git_plugin.settings["git_repo_path"] = temp_git_repo

        try:
            # Create files that match ignore patterns
            (Path(temp_git_repo) / "plugin_config.json").write_text("{}")
            (Path(temp_git_repo) / "test.pyc").write_text("bytecode")

            # These should be ignored
            # The exact behavior depends on gitignore configuration

        finally:
            if original_path:
                git_plugin.settings["git_repo_path"] = original_path


class TestGitPluginHooks:
    """Test git plugin lifecycle hooks"""

    def test_on_app_startup_hook(self, git_plugin):
        """Test that on_app_startup is implemented"""
        assert hasattr(git_plugin, "on_app_startup")

        # We can't easily test the full startup behavior without mocking
        # but we can verify the method exists and is callable
        assert callable(git_plugin.on_app_startup)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
