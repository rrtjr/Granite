"""
Pytest configuration for E2E tests using Playwright.

E2E tests require:
1. playwright package installed: pip install playwright
2. Browser binaries: playwright install

These tests are skipped automatically if playwright is not available
(e.g., in Docker containers where browsers aren't installed).
"""

import os

import pytest

# Check if playwright is available
try:
    from playwright.sync_api import Page  # noqa: F401

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "e2e: mark test as end-to-end browser test")


def pytest_collection_modifyitems(config, items):
    """Skip all e2e tests if playwright is not available."""
    if not PLAYWRIGHT_AVAILABLE:
        skip_marker = pytest.mark.skip(
            reason="playwright not installed (run: pip install playwright && playwright install)"
        )
        for item in items:
            if "e2e" in str(item.fspath):
                item.add_marker(skip_marker)


if PLAYWRIGHT_AVAILABLE:
    # Only define these fixtures if playwright is available

    @pytest.fixture(scope="session")
    def browser_context_args(browser_context_args):
        """Configure browser context for all tests."""
        return {
            **browser_context_args,
            "viewport": {"width": 1280, "height": 720},
        }

    @pytest.fixture(scope="session")
    def base_url():
        """Get the base URL for tests from environment or use default."""
        return os.environ.get("PLAYWRIGHT_BASE_URL", "http://localhost:8000")

    @pytest.fixture
    def authenticated_page(page, base_url):
        """
        Fixture that provides an authenticated page.
        Handles login if TEST_PASSWORD is set, otherwise assumes auth is disabled.
        """
        test_password = os.environ.get("TEST_PASSWORD")

        page.goto(f"{base_url}/")

        # Check if redirected to login
        if "/login" in page.url and test_password:
            page.fill('input[type="password"]', test_password)
            page.click('button[type="submit"]')
            page.wait_for_url(lambda url: "/login" not in url)

        return page

    @pytest.fixture
    def wait_for_app(page):
        """Helper fixture to wait for Alpine.js app initialization."""

        def _wait():
            page.wait_for_selector("[x-data]", timeout=10000)
            # Give Alpine.js time to fully initialize
            page.wait_for_timeout(500)

        return _wait
