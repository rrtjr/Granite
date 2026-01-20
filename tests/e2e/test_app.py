"""
E2E tests for main application functionality.
"""

import pytest

# Conditional import - tests will be skipped if playwright not available
try:
    from playwright.sync_api import Page, expect
except ImportError:
    Page = None
    expect = None


@pytest.mark.e2e
class TestMainApplication:
    """Tests for main application loading and structure."""

    def test_loads_main_application(self, authenticated_page: Page, wait_for_app):
        """Main app should load with Alpine.js initialized."""
        wait_for_app()

        # Check that sidebar exists
        sidebar = authenticated_page.locator(".sidebar, [class*='sidebar']").first
        expect(sidebar).to_be_visible()

    def test_displays_app_name(self, authenticated_page: Page, wait_for_app):
        """App should display Granite branding."""
        wait_for_app()

        app_name = authenticated_page.get_by_text("Granite").first
        expect(app_name).to_be_visible()

    def test_has_navigation_panels(self, authenticated_page: Page, wait_for_app):
        """App should have navigation buttons/panels."""
        wait_for_app()

        nav_buttons = authenticated_page.locator("button, [role='button']")
        assert nav_buttons.count() > 0


@pytest.mark.e2e
class TestNoteOperations:
    """Tests for note list and selection."""

    def test_displays_notes_or_empty_state(self, authenticated_page: Page, wait_for_app):
        """Should show notes list or empty state message."""
        wait_for_app()

        has_notes = authenticated_page.locator("[class*='note'], [data-note]").count() > 0
        has_empty = authenticated_page.get_by_text(pattern="no notes|get started|create").count() > 0

        assert has_notes or has_empty

    def test_has_new_note_action(self, authenticated_page: Page, wait_for_app):
        """Should have a way to create new notes."""
        wait_for_app()

        # Look for new/add buttons or icons
        new_button = authenticated_page.locator("button").filter(has_text=r"new|add|create")
        plus_button = authenticated_page.locator("[class*='new'], [aria-label*='new' i]")

        has_new_action = new_button.count() > 0 or plus_button.count() > 0
        assert has_new_action


@pytest.mark.e2e
class TestThemeSupport:
    """Tests for theme functionality."""

    def test_applies_theme_from_storage(self, authenticated_page: Page, wait_for_app):
        """Theme should be applied from localStorage."""
        wait_for_app()

        html = authenticated_page.locator("html")
        theme = html.get_attribute("data-theme")

        assert theme is not None

    def test_persists_theme_preference(self, authenticated_page: Page, wait_for_app):
        """Theme preference should be saved to localStorage."""
        wait_for_app()

        saved_theme = authenticated_page.evaluate("() => localStorage.getItem('graniteTheme')")
        assert saved_theme is not None


@pytest.mark.e2e
class TestResponsiveDesign:
    """Tests for responsive behavior across viewports."""

    def test_mobile_viewport(self, authenticated_page: Page, wait_for_app):
        """App should work on mobile viewport."""
        authenticated_page.set_viewport_size({"width": 375, "height": 667})
        authenticated_page.reload()
        wait_for_app()

        body = authenticated_page.locator("body")
        expect(body).to_be_visible()

    def test_tablet_viewport(self, authenticated_page: Page, wait_for_app):
        """App should work on tablet viewport."""
        authenticated_page.set_viewport_size({"width": 768, "height": 1024})
        authenticated_page.reload()
        wait_for_app()

        body = authenticated_page.locator("body")
        expect(body).to_be_visible()

    def test_desktop_viewport(self, authenticated_page: Page, wait_for_app):
        """App should work on desktop viewport."""
        authenticated_page.set_viewport_size({"width": 1920, "height": 1080})
        authenticated_page.reload()
        wait_for_app()

        body = authenticated_page.locator("body")
        expect(body).to_be_visible()


@pytest.mark.e2e
class TestAccessibility:
    """Tests for accessibility features."""

    def test_has_proper_document_title(self, authenticated_page: Page, wait_for_app):
        """Page should have a meaningful title."""
        wait_for_app()

        title = authenticated_page.title()
        assert title
        assert "granite" in title.lower()

    def test_supports_keyboard_navigation(self, authenticated_page: Page, wait_for_app):
        """Should support keyboard navigation."""
        wait_for_app()

        # Tab through focusable elements
        authenticated_page.keyboard.press("Tab")

        # Something should be focused (not body)
        focused_tag = authenticated_page.evaluate("() => document.activeElement?.tagName")
        assert focused_tag
        assert focused_tag != "BODY"
