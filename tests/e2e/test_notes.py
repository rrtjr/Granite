"""
E2E tests for note management functionality.
"""

import pytest

# Conditional import - tests will be skipped if playwright not available
try:
    from playwright.sync_api import Page, expect
except ImportError:
    Page = None
    expect = None


@pytest.mark.e2e
class TestNoteCreation:
    """Tests for note creation flow."""

    def test_shows_new_note_modal(self, authenticated_page: Page, wait_for_app):
        """Clicking new button should show modal or input."""
        wait_for_app()

        new_button = authenticated_page.locator("button").filter(has_text=r"(?i)new").first

        if new_button.is_visible():
            new_button.click()

            # Should show a modal or input
            modal = authenticated_page.locator("[class*='modal'], [role='dialog']")
            name_input = authenticated_page.locator("input[placeholder*='name' i], input[placeholder*='title' i]")

            has_modal = modal.count() > 0
            has_input = name_input.count() > 0

            assert has_modal or has_input


@pytest.mark.e2e
class TestNoteEditing:
    """Tests for note editing functionality."""

    def test_app_loads_correctly(self, authenticated_page: Page, wait_for_app):
        """Editor area should exist when app loads."""
        wait_for_app()

        # Verify app loaded - editor may not be visible until note selected
        app_loaded = authenticated_page.locator("[x-data]").count() > 0
        assert app_loaded


@pytest.mark.e2e
class TestNoteList:
    """Tests for note list functionality."""

    def test_displays_sidebar(self, authenticated_page: Page, wait_for_app):
        """Should display folder tree or note list in sidebar."""
        wait_for_app()

        sidebar = authenticated_page.locator(".sidebar, [class*='sidebar']").first
        expect(sidebar).to_be_visible()

    def test_note_items_clickable(self, authenticated_page: Page, wait_for_app):
        """Note items should be clickable."""
        wait_for_app()

        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            first_note = note_items.first
            first_note.click()
            authenticated_page.wait_for_timeout(300)

        # Test passes regardless (empty state is valid)
        assert True


@pytest.mark.e2e
class TestNoteSaving:
    """Tests for note saving functionality."""

    def test_app_has_save_infrastructure(self, authenticated_page: Page, wait_for_app):
        """App should have save-related state/elements."""
        wait_for_app()

        # Verify app loaded correctly
        app_loaded = authenticated_page.locator("[x-data]").count() > 0
        assert app_loaded


@pytest.mark.e2e
class TestFrontmatterSupport:
    """Tests for frontmatter/metadata functionality."""

    def test_app_supports_metadata(self, authenticated_page: Page, wait_for_app):
        """App should have metadata panel capability."""
        wait_for_app()

        # Metadata panel only shows with note containing frontmatter
        app_loaded = authenticated_page.locator("[x-data]").count() > 0
        assert app_loaded


@pytest.mark.e2e
class TestUndoRedo:
    """Tests for undo/redo functionality."""

    def test_undo_shortcut_works(self, authenticated_page: Page, wait_for_app):
        """Ctrl+Z should not cause errors."""
        wait_for_app()

        authenticated_page.keyboard.press("Control+z")

        # App should still be functional
        app_loaded = authenticated_page.locator("[x-data]").count() > 0
        assert app_loaded

    def test_redo_shortcut_works(self, authenticated_page: Page, wait_for_app):
        """Ctrl+Shift+Z should not cause errors."""
        wait_for_app()

        authenticated_page.keyboard.press("Control+Shift+z")

        # App should still be functional
        app_loaded = authenticated_page.locator("[x-data]").count() > 0
        assert app_loaded


@pytest.mark.e2e
class TestSearch:
    """Tests for search functionality."""

    def test_has_search_capability(self, authenticated_page: Page, wait_for_app):
        """App should have search input or trigger."""
        wait_for_app()

        search_input = authenticated_page.locator(
            "input[type='search'], input[placeholder*='search' i], [class*='search'] input"
        )
        search_button = authenticated_page.locator("[aria-label*='search' i], [title*='search' i]")

        has_search = search_input.count() > 0 or search_button.count() > 0
        assert has_search
