"""
Backend tests for Templates System

Tests template path resolution, configurable paths, and template operations

Run with: pytest tests/test_templates.py
"""

import shutil
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from backend.utils import get_template_content, get_templates


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def temp_notes_dir():
    """Create a temporary notes directory with templates"""
    temp_dir = tempfile.mkdtemp()
    notes_path = Path(temp_dir)

    # Create _templates folder with test templates
    templates_dir = notes_path / "_templates"
    templates_dir.mkdir(parents=True)

    # Create test templates
    (templates_dir / "meeting.md").write_text("# Meeting Notes\n{{date}}")
    (templates_dir / "journal.md").write_text("# Journal {{date}}\n## Goals\n")

    yield notes_path

    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.fixture
def temp_notes_dir_custom_path():
    """Create a temporary notes directory with custom templates path"""
    temp_dir = tempfile.mkdtemp()
    notes_path = Path(temp_dir)

    # Create custom templates folder
    custom_templates = notes_path / "my_templates"
    custom_templates.mkdir(parents=True)

    (custom_templates / "test.md").write_text("# Test Template")

    yield notes_path, "my_templates"

    # Cleanup
    shutil.rmtree(temp_dir)


class TestTemplatePathResolution:
    """Test template path resolution with different configurations"""

    def test_get_templates_default_path(self, temp_notes_dir):
        """Test getting templates from default _templates folder"""
        templates = get_templates(str(temp_notes_dir))

        assert len(templates) == 2
        template_names = [t["name"] for t in templates]
        assert "meeting" in template_names
        assert "journal" in template_names

    def test_get_templates_custom_relative_path(self, temp_notes_dir_custom_path):
        """Test getting templates from custom relative path"""
        notes_path, custom_dir = temp_notes_dir_custom_path

        templates = get_templates(str(notes_path), custom_dir)

        assert len(templates) == 1
        assert templates[0]["name"] == "test"

    def test_get_templates_custom_absolute_path(self, temp_notes_dir_custom_path):
        """Test getting templates from custom absolute path"""
        notes_path, custom_dir = temp_notes_dir_custom_path
        absolute_path = str(notes_path / custom_dir)

        templates = get_templates(str(notes_path), absolute_path)

        assert len(templates) == 1
        assert templates[0]["name"] == "test"

    def test_get_template_content_default_path(self, temp_notes_dir):
        """Test getting template content from default path"""
        content = get_template_content(str(temp_notes_dir), "meeting")

        assert content is not None
        assert "Meeting Notes" in content
        assert "{{date}}" in content

    def test_get_template_content_custom_path(self, temp_notes_dir_custom_path):
        """Test getting template content from custom path"""
        notes_path, custom_dir = temp_notes_dir_custom_path

        content = get_template_content(str(notes_path), "test", custom_dir)

        assert content is not None
        assert "Test Template" in content

    def test_get_template_content_not_found(self, temp_notes_dir):
        """Test that getting non-existent template returns None"""
        content = get_template_content(str(temp_notes_dir), "nonexistent")

        assert content is None

    def test_get_templates_empty_directory(self, temp_notes_dir):
        """Test getting templates from non-existent directory"""
        templates = get_templates(str(temp_notes_dir), "nonexistent_folder")

        assert templates == []


class TestTemplatesAPI:
    """Test template-related API endpoints"""

    def test_list_templates(self, client):
        """Test GET /api/templates returns template list"""
        response = client.get("/api/templates")

        assert response.status_code == 200
        data = response.json()

        assert "templates" in data
        assert isinstance(data["templates"], list)

    def test_get_templates_dir_setting(self, client):
        """Test GET /api/settings/templates-dir returns current path"""
        response = client.get("/api/settings/templates-dir")

        assert response.status_code == 200
        data = response.json()

        assert "templatesDir" in data
        assert isinstance(data["templatesDir"], str)

    def test_update_templates_dir_setting(self, client):
        """Test POST /api/settings/templates-dir updates path"""
        new_path = "custom_templates"

        response = client.post("/api/settings/templates-dir", json={"templatesDir": new_path})

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["templatesDir"] == new_path

        # Verify the change persisted
        get_response = client.get("/api/settings/templates-dir")
        assert get_response.json()["templatesDir"] == new_path

    def test_update_templates_dir_requires_value(self, client):
        """Test that updating templates dir requires a value"""
        response = client.post("/api/settings/templates-dir", json={"templatesDir": ""})

        assert response.status_code == 400

    def test_templates_dir_syncs_with_user_settings(self, client):
        """Test that templates dir changes sync with user settings"""
        # Update via templates-dir endpoint
        client.post("/api/settings/templates-dir", json={"templatesDir": "sync_test"})

        # Verify in user settings
        user_settings_response = client.get("/api/settings/user")
        user_settings = user_settings_response.json()

        assert user_settings["paths"]["templatesDir"] == "sync_test"


class TestImageUpload:
    """Test image upload functionality"""

    def test_image_upload_saves_to_root(self, client, temp_notes_dir):
        """Test that image upload saves to root folder"""
        # This is a placeholder - actual implementation would need:
        # 1. Create test image file
        # 2. Upload via /api/upload-image
        # 3. Verify it's saved to root (not _attachments)
        # 4. Verify markdown link uses Obsidian format ![[image.png]]
        # Implement when testing upload functionality

    def test_image_markdown_format(self):
        """Test that image markdown uses Obsidian wiki-link format"""
        # Verify the insertImageMarkdown function generates ![[filename]]
        # This would be tested in frontend tests


class TestTemplateToConfigIntegration:
    """Test integration between template settings and config.yaml"""

    def test_templates_dir_persists_to_config(self, client):
        """Test that template dir changes persist to config.yaml"""
        original_response = client.get("/api/settings/templates-dir")
        original_response.json()["templatesDir"]

        # Update
        new_path = "integration_test_templates"
        client.post("/api/settings/templates-dir", json={"templatesDir": new_path})

        # The setting should be in both user-settings.json and config.yaml
        # Verifying it's accessible after update
        updated_response = client.get("/api/settings/templates-dir")
        assert updated_response.json()["templatesDir"] == new_path
