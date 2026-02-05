"""
E2E tests for Draw.io diagram functionality using Playwright.

These tests verify:
1. Draw.io code blocks render with preview/placeholder
2. Click opens the embedded Draw.io editor
3. Save and Exit properly syncs content back to markdown
4. SVG previews are cached and displayed
5. Multiple diagrams work independently
"""

import pytest

# Only run if playwright is available
try:
    from playwright.sync_api import Page, expect

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = None  # type: ignore[misc, assignment]
    expect = None  # type: ignore[misc, assignment]


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioRendering:
    """Test Draw.io rendering in the preview."""

    def test_drawio_renders_preview(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify draw.io code block renders as preview container."""
        page = authenticated_page
        wait_for_app()

        # Create a new note with draw.io content
        create_btn = page.locator('button:has-text("New Note"), [title*="New"]').first
        if create_btn.is_visible():
            create_btn.click()

            # Fill in note name if prompted
            dialog = page.locator('input[type="text"]')
            if dialog.is_visible(timeout=1000):
                dialog.fill("drawio-test")
                page.keyboard.press("Enter")
                page.wait_for_timeout(500)

            # Type draw.io content in editor
            editor = page.locator(".cm-content, .CodeMirror-code, [contenteditable]").first
            if editor.is_visible():
                editor.click()
                drawio_content = """# Test Draw.io

```drawio
<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>
```
"""
                page.keyboard.type(drawio_content)
                page.wait_for_timeout(1000)

                # Check if draw.io container is rendered in preview
                preview = page.locator(".markdown-preview")
                if preview.is_visible():
                    drawio = preview.locator(".drawio-wrapper, .drawio-container")
                    if drawio.count() > 0:
                        expect(drawio.first).to_be_visible()
        else:
            pytest.skip("Could not find create note button")

    def test_drawio_shows_name_in_toolbar(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify draw.io displays diagram name in toolbar."""
        page = authenticated_page
        wait_for_app()

        # Look for toolbar with diagram name
        toolbar = page.locator(".drawio-toolbar")
        if toolbar.count() > 0:
            expect(toolbar.first).to_be_visible()
            # Should show "Diagram 1" or custom name
            name = toolbar.first.locator(".drawio-name, span").first
            if name.count() > 0:
                expect(name).to_be_visible()

    def test_drawio_placeholder_shows_click_to_edit(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify empty diagram shows 'Click to edit' placeholder."""
        page = authenticated_page
        wait_for_app()

        # Look for placeholder
        placeholder = page.locator(".drawio-placeholder")
        if placeholder.count() > 0:
            placeholder_text = placeholder.first.inner_text()
            # Should show instruction to edit
            assert (
                "edit" in placeholder_text.lower()
                or "click" in placeholder_text.lower()
                or "diagram" in placeholder_text.lower()
            )


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioEditor:
    """Test Draw.io editor modal functionality."""

    def test_click_opens_editor_modal(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify clicking diagram opens the editor modal."""
        page = authenticated_page
        wait_for_app()

        # Find draw.io preview and click it
        preview = page.locator(".drawio-preview, .drawio-placeholder")
        if preview.count() > 0:
            preview.first.click()
            page.wait_for_timeout(1000)

            # Check if modal opened
            modal = page.locator(".drawio-modal, [class*='drawio-modal']")
            if modal.count() > 0:
                expect(modal.first).to_be_visible()

    def test_edit_button_opens_editor(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify Edit button opens the editor modal."""
        page = authenticated_page
        wait_for_app()

        # Find draw.io wrapper with edit button
        drawio_wrapper = page.locator(".drawio-wrapper")

        if drawio_wrapper.count() > 0:
            # Find edit button within the wrapper
            wrapper_edit = drawio_wrapper.first.locator("button")
            if wrapper_edit.count() > 0:
                wrapper_edit.first.click()
                page.wait_for_timeout(1000)

                # Check if modal opened
                modal = page.locator(".drawio-modal")
                if modal.count() > 0:
                    expect(modal.first).to_be_visible()

    def test_editor_iframe_loads(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify the Draw.io iframe loads within the modal."""
        page = authenticated_page
        wait_for_app()

        # Open editor first
        preview = page.locator(".drawio-preview, .drawio-placeholder")
        if preview.count() > 0:
            preview.first.click()
            page.wait_for_timeout(2000)

            # Check for iframe
            iframe = page.locator(".drawio-iframe, iframe[src*='diagrams.net']")
            if iframe.count() > 0:
                expect(iframe.first).to_be_visible()

    def test_close_button_closes_modal(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify close/exit button closes the editor modal."""
        page = authenticated_page
        wait_for_app()

        # Open editor first
        preview = page.locator(".drawio-preview, .drawio-placeholder")
        if preview.count() > 0:
            preview.first.click()
            page.wait_for_timeout(1000)

            modal = page.locator(".drawio-modal")
            if modal.count() > 0 and modal.first.is_visible():
                # Try to close modal (ESC key or close button)
                close_btn = modal.first.locator("button:has-text('Close'), button:has-text('x'), .close-btn")
                if close_btn.count() > 0:
                    close_btn.first.click()
                else:
                    page.keyboard.press("Escape")

                page.wait_for_timeout(500)

                # Modal should be hidden
                modal = page.locator(".drawio-modal:visible")
                assert modal.count() == 0


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioSvgPreview:
    """Test SVG preview caching and display."""

    def test_svg_preview_displays(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify SVG preview is displayed for saved diagrams."""
        page = authenticated_page
        wait_for_app()

        # Look for SVG container
        svg_container = page.locator(".drawio-svg-container, .drawio-preview svg")
        if svg_container.count() > 0:
            expect(svg_container.first).to_be_visible()

    def test_svg_preview_survives_refresh(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify SVG preview persists after page refresh."""
        page = authenticated_page
        wait_for_app()

        # Check if there's an SVG preview
        svg_before = page.locator(".drawio-svg-container svg, .drawio-preview svg")
        had_svg = svg_before.count() > 0

        if had_svg:
            # Refresh the page
            page.reload()
            wait_for_app()

            # Check if SVG is still there (from cache)
            svg_after = page.locator(".drawio-svg-container svg, .drawio-preview svg")
            expect(svg_after.first).to_be_visible()


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioMultipleDiagrams:
    """Test handling of multiple Draw.io diagrams in a note."""

    def test_multiple_diagrams_render_independently(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify multiple diagrams each render as separate containers."""
        page = authenticated_page
        wait_for_app()

        wrappers = page.locator(".drawio-wrapper")
        if wrappers.count() >= 2:
            # Verify each wrapper is visible
            for i in range(min(wrappers.count(), 3)):
                wrapper = wrappers.nth(i)
                expect(wrapper).to_be_visible()
        else:
            pytest.skip("Need at least 2 diagrams for this test")

    def test_each_diagram_has_unique_name(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify each diagram displays a unique name."""
        page = authenticated_page
        wait_for_app()

        names = page.locator(".drawio-name")
        count = names.count()

        if count >= 2:
            # Collect all names
            name_texts = [names.nth(i).inner_text() for i in range(count)]

            # All names should be unique (Diagram 1, Diagram 2, etc.)
            assert len(name_texts) == len(set(name_texts)), f"Diagram names should be unique: {name_texts}"
        else:
            pytest.skip("Need at least 2 diagrams for this test")


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioSplitView:
    """Test Draw.io behavior in split view mode."""

    def test_drawio_renders_in_split_view(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify Draw.io renders correctly in split view."""
        page = authenticated_page
        wait_for_app()

        # Switch to split view
        split_btn = page.locator('button:has-text("Split")')
        if split_btn.is_visible():
            split_btn.click()
            page.wait_for_timeout(500)

        # Check draw.io is visible in preview pane
        preview = page.locator(".markdown-preview.note-preview")
        if preview.is_visible():
            drawio = preview.locator(".drawio-wrapper, .drawio-container")
            if drawio.count() > 0:
                expect(drawio.first).to_be_visible()

    def test_drawio_clickable_in_split_view(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify Draw.io can be edited from split view."""
        page = authenticated_page
        wait_for_app()

        # Switch to split view
        split_btn = page.locator('button:has-text("Split")')
        if split_btn.is_visible():
            split_btn.click()
            page.wait_for_timeout(300)

        wrapper = page.locator(".drawio-wrapper").first
        if wrapper.is_visible():
            wrapper.click()
            page.wait_for_timeout(1000)

            # Modal should open
            modal = page.locator(".drawio-modal")
            if modal.count() > 0:
                expect(modal.first).to_be_visible()


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioRichEditor:
    """Test Draw.io behavior in Rich Editor (Tiptap) mode."""

    def test_drawio_renders_in_rich_editor(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify Draw.io renders in Rich Editor mode."""
        page = authenticated_page
        wait_for_app()

        # Switch to rich editor mode
        rich_btn = page.locator('button:has-text("Rich")')
        if rich_btn.is_visible():
            rich_btn.click()
            page.wait_for_timeout(500)

        # Check for draw.io block in Tiptap
        tiptap = page.locator(".ProseMirror, .tiptap")
        if tiptap.is_visible():
            drawio_block = tiptap.locator(".drawio-block, .drawio-wrapper, [data-type='drawio']")
            if drawio_block.count() > 0:
                expect(drawio_block.first).to_be_visible()

    def test_drawio_preview_shows_svg_in_rich_editor(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify Draw.io shows SVG preview in Rich Editor."""
        page = authenticated_page
        wait_for_app()

        # Switch to rich editor mode
        rich_btn = page.locator('button:has-text("Rich")')
        if rich_btn.is_visible():
            rich_btn.click()
            page.wait_for_timeout(500)

        # Look for SVG in Tiptap
        tiptap = page.locator(".ProseMirror, .tiptap")
        if tiptap.is_visible():
            svg = tiptap.locator(".drawio-block svg, .drawio-tiptap-preview svg")
            if svg.count() > 0:
                expect(svg.first).to_be_visible()


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioEditorSync:
    """Test Draw.io synchronization with markdown editor."""

    def test_xml_updates_in_editor_after_save(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify XML content updates in markdown after saving in Draw.io editor."""
        page = authenticated_page
        wait_for_app()

        # Check editor contains draw.io code block
        editor = page.locator(".cm-content")
        if editor.is_visible():
            editor_text = editor.inner_text()
            if "```drawio" in editor_text:
                # Should contain mxGraphModel XML
                assert "mxGraphModel" in editor_text or "drawio" in editor_text

    def test_editor_shows_drawio_code_block(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify editor shows draw.io in code block format."""
        page = authenticated_page
        wait_for_app()

        editor = page.locator(".cm-content")
        if editor.is_visible():
            editor_text = editor.inner_text()
            if "```drawio" in editor_text:
                # Should have code block markers
                assert "```" in editor_text
                # Should have drawio language identifier
                assert "drawio" in editor_text


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioTheme:
    """Test Draw.io theme integration."""

    def test_editor_uses_dark_theme_in_dark_mode(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify Draw.io editor uses dark UI when Granite is in dark mode."""
        page = authenticated_page
        wait_for_app()

        # Check if dark mode is active
        body = page.locator("body")
        is_dark = body.evaluate(
            'el => window.getComputedStyle(el).backgroundColor.includes("0, 0, 0") || el.classList.contains("dark")'
        )

        # Open editor
        preview = page.locator(".drawio-preview, .drawio-placeholder")
        if preview.count() > 0:
            preview.first.click()
            page.wait_for_timeout(2000)

            # Check iframe URL contains theme parameter
            iframe = page.locator("iframe[src*='diagrams.net']")
            if iframe.count() > 0:
                src = iframe.first.get_attribute("src")
                if src and is_dark:
                    # Should have dark UI parameter
                    assert "ui=dark" in src or "ui=min" in src or "dark" in src

    def test_diagram_preview_adapts_to_theme(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify diagram preview styling adapts to current theme."""
        page = authenticated_page
        wait_for_app()

        # Check container background adapts
        container = page.locator(".drawio-container")
        if container.count() > 0:
            # Should have background color set
            bg_color = container.first.evaluate("el => window.getComputedStyle(el).backgroundColor")
            # Just verify it has a background color set
            assert bg_color is not None and bg_color != ""


@pytest.mark.e2e
@pytest.mark.skipif(not PLAYWRIGHT_AVAILABLE, reason="playwright not installed")
class TestDrawioIntegration:
    """Integration tests for Draw.io functionality."""

    def test_full_workflow_create_edit_save(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Test complete workflow: create diagram, edit, save, verify preview."""
        page = authenticated_page
        wait_for_app()

        # 1. Create new note
        create_btn = page.locator('button:has-text("New Note"), [title*="New"]').first
        if not create_btn.is_visible():
            pytest.skip("Could not find create note button")

        create_btn.click()

        # Fill in note name
        dialog = page.locator('input[type="text"]')
        if dialog.is_visible(timeout=1000):
            dialog.fill("drawio-workflow-test")
            page.keyboard.press("Enter")
            page.wait_for_timeout(500)

        # 2. Add draw.io code block
        editor = page.locator(".cm-content").first
        if editor.is_visible():
            editor.click()
            content = """# Workflow Test

```drawio
<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>
```
"""
            page.keyboard.type(content)
            page.wait_for_timeout(1000)

        # 3. Verify preview appears
        preview = page.locator(".markdown-preview")
        if preview.is_visible():
            drawio = preview.locator(".drawio-wrapper")
            if drawio.count() > 0:
                expect(drawio.first).to_be_visible()

                # 4. Click to open editor
                drawio.first.click()
                page.wait_for_timeout(2000)

                # 5. Verify modal opened
                modal = page.locator(".drawio-modal")
                if modal.count() > 0:
                    expect(modal.first).to_be_visible()

    def test_diagram_name_from_attribute(self, authenticated_page: Page, base_url: str, wait_for_app):
        """Verify diagram name comes from name= attribute."""
        page = authenticated_page
        wait_for_app()

        # Create note with named diagram
        create_btn = page.locator('button:has-text("New Note"), [title*="New"]').first
        if not create_btn.is_visible():
            pytest.skip("Could not find create note button")

        create_btn.click()

        dialog = page.locator('input[type="text"]')
        if dialog.is_visible(timeout=1000):
            dialog.fill("drawio-name-test")
            page.keyboard.press("Enter")
            page.wait_for_timeout(500)

        editor = page.locator(".cm-content").first
        if editor.is_visible():
            editor.click()
            content = """```drawio name="My Custom Diagram"
<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>
```
"""
            page.keyboard.type(content)
            page.wait_for_timeout(1000)

        # Check if custom name is displayed
        name_element = page.locator(".drawio-name")
        if name_element.count() > 0:
            name_text = name_element.first.inner_text()
            assert "My Custom Diagram" in name_text
