"""
Backend tests for the PDF Export Plugin

Run with: pytest tests/test_pdf_export_plugin.py -v
"""

import importlib.util
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
def pdf_plugin(plugin_manager):
    """Get the PDF export plugin instance"""
    pdf = plugin_manager.plugins.get("pdf_export")
    if not pdf:
        pytest.skip("PDF Export plugin not found")
    return pdf


class TestPDFExportPluginAPI:
    """Test the PDF export plugin API endpoints"""

    def test_get_pdf_export_settings(self, client):
        """Test GET /api/plugins/pdf_export/settings"""
        response = client.get("/api/plugins/pdf_export/settings")

        # Should return 200 if PDF export plugin exists, 404 otherwise
        if response.status_code == 404:
            pytest.skip("PDF Export plugin not found")

        assert response.status_code == 200
        data = response.json()

        assert "settings" in data
        assert isinstance(data["settings"], dict)

        # Verify expected settings keys
        settings = data["settings"]
        assert "page_size" in settings
        assert "orientation" in settings
        assert "margin_top" in settings
        assert "margin_bottom" in settings
        assert "margin_left" in settings
        assert "margin_right" in settings
        assert "include_title" in settings
        assert "include_date" in settings
        assert "include_author" in settings
        assert "author_name" in settings
        assert "font_family" in settings
        assert "font_size" in settings
        assert "line_height" in settings
        assert "code_background" in settings
        assert "enable_tables" in settings
        assert "enable_code_highlighting" in settings
        assert "enable_toc" in settings

    def test_update_pdf_export_settings(self, client):
        """Test POST /api/plugins/pdf_export/settings"""
        new_settings = {
            "page_size": "Letter",
            "orientation": "landscape",
            "font_family": "sans-serif",
            "include_author": True,
            "author_name": "Test Author",
        }

        response = client.post("/api/plugins/pdf_export/settings", json=new_settings)

        if response.status_code == 404:
            pytest.skip("PDF Export plugin not found")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "settings" in data

        # Verify settings were updated
        settings = data["settings"]
        assert settings["page_size"] == "Letter"
        assert settings["orientation"] == "landscape"
        assert settings["font_family"] == "sans-serif"
        assert settings["include_author"] is True
        assert settings["author_name"] == "Test Author"

    def test_get_pdf_export_options(self, client):
        """Test GET /api/plugins/pdf_export/options"""
        response = client.get("/api/plugins/pdf_export/options")

        if response.status_code == 404:
            pytest.skip("PDF Export plugin not found")

        assert response.status_code == 200
        data = response.json()

        assert "page_sizes" in data
        assert "orientations" in data
        assert "fonts" in data

        assert isinstance(data["page_sizes"], list)
        assert isinstance(data["orientations"], list)
        assert isinstance(data["fonts"], list)

        # Verify expected values
        assert "A4" in data["page_sizes"]
        assert "Letter" in data["page_sizes"]
        assert "portrait" in data["orientations"]
        assert "landscape" in data["orientations"]
        assert "serif" in data["fonts"]
        assert "sans-serif" in data["fonts"]

    def test_export_note_to_pdf_disabled_plugin(self, client):
        """Test export fails when plugin is disabled"""
        # First disable the plugin
        client.post("/api/plugins/pdf_export/toggle", json={"enabled": False})

        export_data = {"note_path": "test-note.md", "content": "# Test Note\n\nThis is a test."}

        response = client.post("/api/plugins/pdf_export/export", json=export_data)

        # Should fail with 400 if plugin is disabled
        if response.status_code != 404:  # Plugin exists
            assert response.status_code == 400
            data = response.json()
            assert "not enabled" in data["detail"].lower()

    def test_export_note_to_pdf_missing_content(self, client):
        """Test export fails when content is missing"""
        # Enable the plugin first
        client.post("/api/plugins/pdf_export/toggle", json={"enabled": True})

        export_data = {
            "note_path": "test-note.md"
            # Missing content
        }

        response = client.post("/api/plugins/pdf_export/export", json=export_data)

        if response.status_code != 404:  # Plugin exists
            assert response.status_code == 400
            data = response.json()
            assert "content" in data["detail"].lower()

    def test_export_note_to_pdf_missing_path(self, client):
        """Test export fails when note_path is missing"""
        # Enable the plugin first
        client.post("/api/plugins/pdf_export/toggle", json={"enabled": True})

        export_data = {
            "content": "# Test Note"
            # Missing note_path
        }

        response = client.post("/api/plugins/pdf_export/export", json=export_data)

        if response.status_code != 404:  # Plugin exists
            assert response.status_code == 400
            data = response.json()
            assert "note_path" in data["detail"].lower()


class TestPDFExportPluginUnit:
    """Unit tests for the PDF export plugin"""

    def test_plugin_exists(self, plugin_manager):
        """Test that the PDF export plugin is loaded"""
        if "pdf_export" not in plugin_manager.plugins:
            pytest.skip("PDF Export plugin not loaded (likely missing system dependencies like libpango)")

        plugin = plugin_manager.plugins["pdf_export"]
        assert plugin.name == "PDF Export"
        assert plugin.version == "1.0.0"

    def test_plugin_default_settings(self, pdf_plugin):
        """Test plugin has correct default settings"""
        settings = pdf_plugin.get_settings()

        assert settings["page_size"] == "A4"
        assert settings["orientation"] == "portrait"
        assert settings["margin_top"] == "2cm"
        assert settings["margin_bottom"] == "2cm"
        assert settings["margin_left"] == "2cm"
        assert settings["margin_right"] == "2cm"
        assert settings["include_title"] is True
        assert settings["include_date"] is True
        assert settings["include_author"] is False
        assert settings["author_name"] == ""
        assert settings["font_family"] == "serif"
        assert settings["font_size"] == "11pt"
        assert settings["line_height"] == "1.6"
        assert settings["code_background"] == "#f5f5f5"
        assert settings["enable_tables"] is True
        assert settings["enable_code_highlighting"] is True
        assert settings["enable_toc"] is False

    def test_plugin_update_settings(self, pdf_plugin):
        """Test updating plugin settings"""
        new_settings = {
            "page_size": "Legal",
            "orientation": "landscape",
            "font_family": "monospace",
            "include_author": True,
            "author_name": "John Doe",
        }

        pdf_plugin.update_settings(new_settings)
        settings = pdf_plugin.get_settings()

        assert settings["page_size"] == "Legal"
        assert settings["orientation"] == "landscape"
        assert settings["font_family"] == "monospace"
        assert settings["include_author"] is True
        assert settings["author_name"] == "John Doe"

    def test_plugin_supported_page_sizes(self, pdf_plugin):
        """Test getting supported page sizes"""
        page_sizes = pdf_plugin.get_supported_page_sizes()

        assert isinstance(page_sizes, list)
        assert "A4" in page_sizes
        assert "Letter" in page_sizes
        assert "Legal" in page_sizes
        assert "A5" in page_sizes
        assert "A3" in page_sizes

    def test_plugin_supported_orientations(self, pdf_plugin):
        """Test getting supported orientations"""
        orientations = pdf_plugin.get_supported_orientations()

        assert isinstance(orientations, list)
        assert "portrait" in orientations
        assert "landscape" in orientations

    def test_plugin_supported_fonts(self, pdf_plugin):
        """Test getting supported fonts"""
        fonts = pdf_plugin.get_supported_fonts()

        assert isinstance(fonts, list)
        assert "serif" in fonts
        assert "sans-serif" in fonts
        assert "monospace" in fonts

    def test_generate_base_css(self, pdf_plugin):
        """Test CSS generation"""
        css = pdf_plugin._get_base_css()

        assert isinstance(css, str)
        assert "@page" in css
        assert "body" in css
        assert pdf_plugin.settings["page_size"] in css
        assert pdf_plugin.settings["orientation"] in css
        assert pdf_plugin.settings["font_family"] in css

    def test_get_markdown_extensions(self, pdf_plugin):
        """Test markdown extensions list"""
        extensions = pdf_plugin._get_markdown_extensions()

        assert isinstance(extensions, list)
        assert "extra" in extensions
        assert "nl2br" in extensions
        assert "sane_lists" in extensions

        # Test conditional extensions
        pdf_plugin.update_settings({"enable_tables": True})
        extensions = pdf_plugin._get_markdown_extensions()
        assert "tables" in extensions

        pdf_plugin.update_settings({"enable_code_highlighting": True})
        extensions = pdf_plugin._get_markdown_extensions()
        assert "codehilite" in extensions

        pdf_plugin.update_settings({"enable_toc": True})
        extensions = pdf_plugin._get_markdown_extensions()
        assert "toc" in extensions

    def test_generate_metadata_html(self, pdf_plugin):
        """Test metadata HTML generation"""
        # Test with all metadata enabled
        pdf_plugin.update_settings(
            {"include_title": True, "include_date": True, "include_author": True, "author_name": "Test Author"}
        )

        html = pdf_plugin._generate_metadata_html("Test Note", "test.md")

        assert isinstance(html, str)
        assert "Test Note" in html
        assert "Test Author" in html
        assert "Generated:" in html
        assert "metadata" in html

        # Test with metadata disabled
        pdf_plugin.update_settings({"include_title": False, "include_date": False, "include_author": False})

        html = pdf_plugin._generate_metadata_html("Test Note", "test.md")
        assert "Test Note" not in html


class TestPDFExportPluginIntegration:
    """Integration tests for PDF export (requires weasyprint)"""

    def test_export_simple_note(self, pdf_plugin):
        """Test exporting a simple note to PDF"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = "# Test Note\n\nThis is a test note."

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "test.pdf"

            success, _message = pdf_plugin.export_to_pdf(content=content, output_path=output_path, title="Test Note")

            assert success is True
            assert Path(output_path).exists()
            assert Path(output_path).stat().st_size > 0

    def test_export_note_with_code(self, pdf_plugin):
        """Test exporting a note with code blocks"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = """# Code Example

```python
def hello():
    print("Hello, World!")
```

Inline `code` example.
"""

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "test.pdf"

            success, _message = pdf_plugin.export_to_pdf(content=content, output_path=output_path, title="Code Example")

            assert success is True
            assert Path(output_path).exists()

    def test_export_note_with_table(self, pdf_plugin):
        """Test exporting a note with tables"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = """# Table Example

| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |
| Jane | 25  | LA   |
"""

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "test.pdf"

            success, _message = pdf_plugin.export_to_pdf(
                content=content, output_path=output_path, title="Table Example"
            )

            assert success is True
            assert Path(output_path).exists()

    def test_export_note_with_lists(self, pdf_plugin):
        """Test exporting a note with lists"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = """# Lists

## Unordered List
- Item 1
- Item 2
  - Nested item
- Item 3

## Ordered List
1. First
2. Second
3. Third
"""

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "test.pdf"

            success, _message = pdf_plugin.export_to_pdf(
                content=content, output_path=output_path, title="Lists Example"
            )

            assert success is True
            assert Path(output_path).exists()

    def test_export_note_method(self, pdf_plugin):
        """Test the export_note convenience method"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = "# Test Note\n\nContent here."

        success, _message, pdf_path = pdf_plugin.export_note(note_path="test-note.md", content=content)

        assert success is True
        assert pdf_path is not None
        assert Path(pdf_path).exists()
        assert pdf_path.endswith(".pdf")

        # Cleanup
        if pdf_path and Path(pdf_path).exists():
            Path(pdf_path).unlink()

    def test_export_with_custom_filename(self, pdf_plugin):
        """Test exporting with custom filename"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = "# Custom Name\n\nContent."

        success, _message, pdf_path = pdf_plugin.export_note(
            note_path="original.md", content=content, output_filename="custom-name.pdf"
        )

        assert success is True
        assert pdf_path is not None
        assert "custom-name.pdf" in pdf_path

        # Cleanup
        if pdf_path and Path(pdf_path).exists():
            Path(pdf_path).unlink()

    def test_export_with_different_page_sizes(self, pdf_plugin):
        """Test exporting with different page sizes"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = "# Page Size Test\n\nTesting different page sizes."

        for page_size in ["A4", "Letter", "Legal"]:
            pdf_plugin.update_settings({"page_size": page_size})

            with tempfile.TemporaryDirectory() as temp_dir:
                output_path = Path(temp_dir) / f"test_{page_size}.pdf"

                success, _message = pdf_plugin.export_to_pdf(
                    content=content, output_path=output_path, title=f"{page_size} Test"
                )

                assert success is True
                assert Path(output_path).exists()

    def test_export_with_landscape_orientation(self, pdf_plugin):
        """Test exporting with landscape orientation"""
        if importlib.util.find_spec("weasyprint") is None:
            pytest.skip("weasyprint not installed")

        content = "# Landscape Test\n\nTesting landscape orientation."

        pdf_plugin.update_settings({"orientation": "landscape"})

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "landscape.pdf"

            success, _message = pdf_plugin.export_to_pdf(
                content=content, output_path=output_path, title="Landscape Test"
            )

            assert success is True
            assert Path(output_path).exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
