"""
E2E tests for login functionality.
"""

import os

import pytest

# Conditional import - tests will be skipped if playwright not available
try:
    from playwright.sync_api import Page, expect
except ImportError:
    Page = None
    expect = None


@pytest.mark.e2e
class TestLoginPage:
    """Tests for the login page UI and elements."""

    def test_displays_login_form_elements(self, page: Page, base_url: str):
        """Login page should display all required form elements."""
        page.goto(f"{base_url}/login")

        # Check logo is present
        expect(page.locator(".logo")).to_be_visible()

        # Check title
        expect(page.locator("h1")).to_contain_text("Granite")

        # Check tagline
        expect(page.locator(".tagline")).to_contain_text("Self-Hosted Knowledge Base")

        # Check password input exists
        password_input = page.locator('input[type="password"]')
        expect(password_input).to_be_visible()
        expect(password_input).to_have_attribute("placeholder", "Enter your password")

        # Check submit button
        submit_button = page.locator('button[type="submit"]')
        expect(submit_button).to_be_visible()
        expect(submit_button).to_contain_text("Unlock")

    def test_focuses_password_input_on_load(self, page: Page, base_url: str):
        """Password input should be focused when page loads."""
        page.goto(f"{base_url}/login")

        password_input = page.locator('input[type="password"]')
        expect(password_input).to_be_focused()

    def test_shows_error_for_invalid_password(self, page: Page, base_url: str):
        """Submitting wrong password should show error (stay on login page)."""
        page.goto(f"{base_url}/login")

        # Enter wrong password
        page.fill('input[type="password"]', "wrongpassword")
        page.click('button[type="submit"]')

        # Should still be on login page (not redirected)
        expect(page).to_have_url(lambda url: "/login" in url)

    def test_responsive_design_mobile(self, page: Page, base_url: str):
        """Login page should work on mobile viewport."""
        page.set_viewport_size({"width": 375, "height": 667})
        page.goto(f"{base_url}/login")

        container = page.locator(".login-container")
        expect(container).to_be_visible()

        password_input = page.locator('input[type="password"]')
        expect(password_input).to_be_visible()

    def test_has_github_link_in_footer(self, page: Page, base_url: str):
        """Footer should contain GitHub link."""
        page.goto(f"{base_url}/login")

        github_link = page.locator('a[href*="github.com/rrtjr/Granite"]')
        expect(github_link).to_be_visible()
        expect(github_link).to_have_attribute("target", "_blank")


@pytest.mark.e2e
class TestLoginAuthentication:
    """Tests for authentication flow."""

    @pytest.mark.skipif(not os.environ.get("TEST_PASSWORD"), reason="TEST_PASSWORD not set")
    def test_redirects_after_successful_login(self, page: Page, base_url: str):
        """Successful login should redirect to main app."""
        test_password = os.environ.get("TEST_PASSWORD")

        page.goto(f"{base_url}/login")
        page.fill('input[type="password"]', test_password)
        page.click('button[type="submit"]')

        # Should redirect away from login
        expect(page).not_to_have_url(lambda url: "/login" in url)

    @pytest.mark.skipif(not os.environ.get("TEST_PASSWORD"), reason="TEST_PASSWORD not set")
    def test_maintains_session_after_login(self, page: Page, base_url: str):
        """Session should persist after page refresh."""
        test_password = os.environ.get("TEST_PASSWORD")

        page.goto(f"{base_url}/login")
        page.fill('input[type="password"]', test_password)
        page.click('button[type="submit"]')

        # Wait for redirect
        page.wait_for_url(lambda url: "/login" not in url)

        # Refresh page - should stay logged in
        page.reload()
        expect(page).not_to_have_url(lambda url: "/login" in url)
