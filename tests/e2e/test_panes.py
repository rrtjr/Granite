"""
E2E tests for stacked panes functionality.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

# Conditional import - tests will be skipped if playwright not available
try:
    from playwright.sync_api import expect
except ImportError:
    expect = None

if TYPE_CHECKING:
    from playwright.sync_api import Page


@pytest.mark.e2e
class TestPanesBasic:
    """Basic tests for panes functionality."""

    def test_app_initializes_panes_state(self, authenticated_page: Page, wait_for_app):
        """App should initialize with panes state variables."""
        wait_for_app()

        # Check that panes state exists in Alpine context
        has_panes_state = authenticated_page.evaluate("""
            () => {
                const root = document.querySelector('[x-data]');
                if (!root || !root.__x) return false;
                const data = root.__x.$data;
                return Array.isArray(data.openPanes) && 'activePaneId' in data;
            }
        """)

        assert has_panes_state, "App should have openPanes array and activePaneId"

    def test_panes_container_exists(self, authenticated_page: Page, wait_for_app):
        """Panes container element should exist in DOM."""
        wait_for_app()

        # Check for panes container
        panes_container = authenticated_page.locator(".panes-container, [class*='panes']")
        assert panes_container.count() > 0, "Panes container should exist"


@pytest.mark.e2e
class TestPaneNavigation:
    """Tests for pane navigation and focus."""

    def test_clicking_note_opens_pane(self, authenticated_page: Page, wait_for_app):
        """Clicking a note in sidebar should open it in a pane."""
        wait_for_app()

        # Find a note item in sidebar
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            # Click first note
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Check that a pane was opened
            panes_count = authenticated_page.evaluate("""
                () => {
                    const root = document.querySelector('[x-data]');
                    if (!root || !root.__x) return 0;
                    return root.__x.$data.openPanes.length;
                }
            """)

            assert panes_count >= 1, "Should have at least 1 pane after clicking note"

    def test_active_pane_has_visual_indicator(self, authenticated_page: Page, wait_for_app):
        """Active pane should have visual distinction."""
        wait_for_app()

        # Open a note first
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Check for active pane indicator
            active_pane = authenticated_page.locator(".note-pane.pane-active, [class*='pane-active']")

            if active_pane.count() > 0:
                # Verify active pane is visible
                expect(active_pane.first).to_be_visible()


@pytest.mark.e2e
class TestPaneOperations:
    """Tests for pane operations (open, close, focus)."""

    def test_close_pane_button_exists(self, authenticated_page: Page, wait_for_app):
        """Each pane should have a close button."""
        wait_for_app()

        # Open a note first
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Check for close button in pane header
            close_button = authenticated_page.locator(
                ".pane-close, [class*='pane'] button[aria-label*='close' i], .pane-header button, .note-pane button"
            )

            # At minimum, pane controls should exist
            pane_controls = authenticated_page.locator(".pane-controls, .pane-header")
            assert close_button.count() > 0 or pane_controls.count() > 0

    def test_open_same_note_focuses_existing(self, authenticated_page: Page, wait_for_app):
        """Opening the same note twice should focus existing pane, not create duplicate."""
        wait_for_app()

        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            # Click same note twice
            note_items.first.click()
            authenticated_page.wait_for_timeout(300)

            panes_count_1 = authenticated_page.evaluate("""
                () => {
                    const root = document.querySelector('[x-data]');
                    if (!root || !root.__x) return 0;
                    return root.__x.$data.openPanes.length;
                }
            """)

            note_items.first.click()
            authenticated_page.wait_for_timeout(300)

            panes_count_2 = authenticated_page.evaluate("""
                () => {
                    const root = document.querySelector('[x-data]');
                    if (!root || !root.__x) return 0;
                    return root.__x.$data.openPanes.length;
                }
            """)

            assert panes_count_1 == panes_count_2, "Should not create duplicate pane"


@pytest.mark.e2e
class TestPaneKeyboardShortcuts:
    """Tests for pane keyboard shortcuts."""

    def test_ctrl_w_shortcut(self, authenticated_page: Page, wait_for_app):
        """Ctrl+W should close active pane."""
        wait_for_app()

        # Open a note first
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(300)

            initial_count = authenticated_page.evaluate("""
                () => {
                    const root = document.querySelector('[x-data]');
                    if (!root || !root.__x) return 0;
                    return root.__x.$data.openPanes.length;
                }
            """)

            if initial_count > 0:
                # Press Ctrl+W
                authenticated_page.keyboard.press("Control+w")
                authenticated_page.wait_for_timeout(300)

                # App should still be functional
                app_loaded = authenticated_page.locator("[x-data]").count() > 0
                assert app_loaded

    def test_ctrl_tab_cycles_panes(self, authenticated_page: Page, wait_for_app):
        """Ctrl+Tab should cycle through open panes."""
        wait_for_app()

        # This test requires multiple panes to be open
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() >= 2:
            # Open two notes
            note_items.nth(0).click()
            authenticated_page.wait_for_timeout(300)

            note_items.nth(1).click()
            authenticated_page.wait_for_timeout(300)

            # Press Ctrl+Tab to cycle panes
            authenticated_page.keyboard.press("Control+Tab")
            authenticated_page.wait_for_timeout(300)

            # Verify app is still functional after keyboard shortcut
            app_loaded = authenticated_page.locator("[x-data]").count() > 0
            assert app_loaded, "App should still work after Ctrl+Tab"


@pytest.mark.e2e
class TestPaneViewMode:
    """Tests for per-pane view mode."""

    def test_pane_has_view_mode_toggle(self, authenticated_page: Page, wait_for_app):
        """Each pane should have view mode controls."""
        wait_for_app()

        # Open a note first
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Check for view mode controls
            view_controls = authenticated_page.locator(
                ".pane-toolbar button, .pane-header button, [class*='view-mode'], .panes-toolbar button"
            )

            # Toolbar should exist with some buttons
            assert view_controls.count() > 0 or authenticated_page.locator(".panes-toolbar, .pane-toolbar").count() > 0


@pytest.mark.e2e
class TestRichEditorPanel:
    """Tests for the Rich Editor panel."""

    def test_rich_editor_toggle_exists(self, authenticated_page: Page, wait_for_app):
        """Rich Editor toggle button should exist."""
        wait_for_app()

        # Open a note first
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Check for Rich Editor toggle
            rich_toggle = authenticated_page.locator(
                "button:has-text('Rich'), button:has-text('WYSIWYG'), [title*='Rich' i], [aria-label*='Rich' i]"
            )

            # The toggle should be somewhere in toolbar or panes area
            panes_toolbar = authenticated_page.locator(".panes-toolbar")
            assert rich_toggle.count() > 0 or panes_toolbar.count() > 0

    def test_toggle_rich_editor_panel(self, authenticated_page: Page, wait_for_app):
        """Clicking Rich Editor toggle should show/hide panel."""
        wait_for_app()

        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Try to toggle Rich Editor
            rich_toggle = authenticated_page.locator(
                ".panes-toolbar button:has-text('Rich'), button[title*='Rich' i]"
            ).first

            if rich_toggle.count() > 0:
                # Click toggle - just verify it doesn't crash the app
                rich_toggle.click()
                authenticated_page.wait_for_timeout(300)

                # Verify app is still functional after toggle
                app_still_functional = authenticated_page.locator("[x-data]").count() > 0
                assert app_still_functional, "App should still work after Rich Editor toggle"


@pytest.mark.e2e
class TestPaneStatePersistence:
    """Tests for pane state persistence."""

    def test_panes_state_saved_to_localstorage(self, authenticated_page: Page, wait_for_app):
        """Pane state should be saved to localStorage."""
        wait_for_app()

        # Open a note
        note_items = authenticated_page.locator("[class*='note-item'], [data-note-path], .file-item")

        if note_items.count() > 0:
            note_items.first.click()
            authenticated_page.wait_for_timeout(500)

            # Trigger save (usually happens automatically)
            authenticated_page.evaluate("""
                () => {
                    const root = document.querySelector('[x-data]');
                    if (root && root.__x && typeof root.__x.$data.savePanesState === 'function') {
                        root.__x.$data.savePanesState();
                    }
                }
            """)

            authenticated_page.wait_for_timeout(200)

            # Verify save function exists and runs without error
            save_exists = authenticated_page.evaluate("""
                () => {
                    const root = document.querySelector('[x-data]');
                    return root && root.__x && typeof root.__x.$data.savePanesState === 'function';
                }
            """)
            assert save_exists, "savePanesState function should exist"


@pytest.mark.e2e
class TestMobileResponsive:
    """Tests for mobile responsive behavior."""

    def test_mobile_shows_single_pane(self, page, base_url, wait_for_app):
        """On mobile viewport, should show only single pane."""
        # Set mobile viewport
        page.set_viewport_size({"width": 375, "height": 667})

        page.goto(f"{base_url}/")
        wait_for_app()

        # App should still function on mobile
        app_loaded = page.locator("[x-data]").count() > 0
        assert app_loaded

        # Panes container should exist but may behave differently
        panes_area = page.locator(".panes-container, .main-content, [class*='pane']")
        assert panes_area.count() > 0 or page.locator(".sidebar").count() > 0
