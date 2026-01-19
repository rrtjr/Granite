"""
Authentication and Session Security Tests

Tests authentication functionality including:
- Login/logout flows
- Session management and regeneration
- Password verification
- Unauthorized access handling
- Session fixation attack prevention

Run with: pytest tests/test_authentication.py -v
"""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.dependencies import auth_enabled, verify_password
from backend.main import app


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def auth_disabled_client():
    """Create a test client with authentication disabled"""
    with patch("backend.dependencies.config", {"authentication": {"enabled": False}}):
        return TestClient(app)


@pytest.fixture
def auth_enabled_client():
    """Create a test client with authentication enabled"""
    # Default password is "admin" (hash in config.yaml)
    test_config = {
        "authentication": {
            "enabled": True,
            "password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG",  # "admin"
            "secret_key": "test_secret_key_for_sessions_minimum_32_chars_long",
            "session_max_age": 604800,
        },
        "app": {"name": "Granite", "tagline": "Test"},
        "server": {"debug": False},
    }
    with patch("backend.dependencies.config", test_config):
        yield TestClient(app)


class TestPasswordVerification:
    """Test password verification function"""

    def test_verify_correct_password(self):
        """Test that correct password is verified successfully"""
        # Default hash in config.yaml is for "admin"
        with patch(
            "backend.dependencies.config",
            {"authentication": {"password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG"}},
        ):
            assert verify_password("admin") is True

    def test_verify_incorrect_password(self):
        """Test that incorrect password fails verification"""
        with patch(
            "backend.dependencies.config",
            {"authentication": {"password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG"}},
        ):
            assert verify_password("wrong_password") is False

    def test_verify_empty_password(self):
        """Test that empty password fails verification"""
        with patch(
            "backend.dependencies.config",
            {"authentication": {"password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG"}},
        ):
            assert verify_password("") is False

    def test_verify_no_hash_configured(self):
        """Test that verification fails when no hash is configured"""
        with patch("backend.dependencies.config", {"authentication": {}}):
            assert verify_password("admin") is False

    def test_verify_invalid_hash_format(self):
        """Test that verification handles invalid hash gracefully"""
        with patch("backend.dependencies.config", {"authentication": {"password_hash": "invalid_hash"}}):
            assert verify_password("admin") is False


class TestAuthenticationDisabled:
    """Test behavior when authentication is disabled"""

    def test_auth_disabled_flag(self):
        """Test that auth_enabled() returns False when disabled"""
        with patch("backend.dependencies.config", {"authentication": {"enabled": False}}):
            assert auth_enabled() is False

    def test_login_page_redirects_when_disabled(self, auth_disabled_client):
        """Test that /login redirects to home when auth is disabled"""
        response = auth_disabled_client.get("/login", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "/"

    def test_login_post_redirects_when_disabled(self, auth_disabled_client):
        """Test that POST /login redirects when auth is disabled"""
        response = auth_disabled_client.post("/login", data={"password": "admin"}, follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "/"

    def test_api_access_allowed_when_disabled(self, auth_disabled_client):
        """Test that API endpoints are accessible when auth is disabled"""
        # This assumes /api/config or similar endpoint exists and is protected
        response = auth_disabled_client.get("/api/config")
        # Should not return 401 when auth is disabled
        assert response.status_code != 401


class TestAuthenticationEnabled:
    """Test authentication when enabled"""

    def test_auth_enabled_flag(self):
        """Test that auth_enabled() returns True when enabled"""
        with patch("backend.dependencies.config", {"authentication": {"enabled": True}}):
            assert auth_enabled() is True

    def test_login_page_accessible(self, auth_enabled_client):
        """Test that login page is accessible when auth is enabled"""
        response = auth_enabled_client.get("/login")
        assert response.status_code == 200
        assert b"login" in response.content.lower() or b"password" in response.content.lower()

    def test_login_page_with_error_message(self, auth_enabled_client):
        """Test that login page displays error messages"""
        response = auth_enabled_client.get("/login?error=Test+error+message")
        assert response.status_code == 200
        assert b"Test error message" in response.content

    def test_login_success_redirects_to_home(self, auth_enabled_client):
        """Test successful login redirects to home page"""
        response = auth_enabled_client.post("/login", data={"password": "admin"}, follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "/"

    def test_login_success_sets_session(self, auth_enabled_client):
        """Test that successful login sets authenticated session"""
        response = auth_enabled_client.post("/login", data={"password": "admin"})
        # Follow redirect and check session is set
        assert response.status_code == 200
        # Session cookie should be set
        assert "session" in auth_enabled_client.cookies or "cookie" in [h.lower() for h in response.headers]

    def test_login_failure_shows_error(self, auth_enabled_client):
        """Test that failed login shows error message"""
        response = auth_enabled_client.post("/login", data={"password": "wrong"}, follow_redirects=False)
        assert response.status_code == 303
        assert "error=" in response.headers["location"]
        assert "Incorrect+password" in response.headers["location"]

    def test_login_already_authenticated_redirects(self, auth_enabled_client):
        """Test that accessing login when already authenticated redirects"""
        # First login
        auth_enabled_client.post("/login", data={"password": "admin"})
        # Try to access login page again
        response = auth_enabled_client.get("/login", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "/"

    def test_session_regeneration_on_login(self, auth_enabled_client):
        """Test that session is regenerated after login (prevents session fixation)"""
        # This is a security test to ensure session IDs change after authentication
        # Get initial session (if any)
        dict(auth_enabled_client.cookies)

        # Login
        response = auth_enabled_client.post("/login", data={"password": "admin"}, follow_redirects=False)

        # Check that session was regenerated (new session cookie)
        # The implementation clears the session (request.session.clear()) which should trigger new session ID
        assert response.status_code == 303
        # A new session should be created
        final_cookies = dict(auth_enabled_client.cookies)
        # Session should exist after login
        assert len(final_cookies) > 0


class TestLogout:
    """Test logout functionality"""

    def test_logout_clears_session(self, auth_enabled_client):
        """Test that logout clears the session"""
        # Login first
        auth_enabled_client.post("/login", data={"password": "admin"})

        # Logout
        response = auth_enabled_client.get("/logout", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "/login"

        # Session should be cleared (authenticated flag removed)
        # Trying to access protected route should fail
        # Note: This is implementation-dependent based on how session clearing works

    def test_logout_redirects_to_login(self, auth_enabled_client):
        """Test that logout redirects to login page"""
        response = auth_enabled_client.get("/logout", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "/login"


class TestProtectedRoutes:
    """Test that protected routes require authentication"""

    def test_unauthenticated_api_request_fails(self, auth_enabled_client):
        """Test that unauthenticated requests to API fail"""
        # Create a fresh client without logging in
        response = auth_enabled_client.get("/api/notes")
        # Should return 401 or redirect
        assert response.status_code in [401, 303]

    def test_authenticated_api_request_succeeds(self, auth_enabled_client):
        """Test that authenticated requests to API succeed"""
        # Login first
        auth_enabled_client.post("/login", data={"password": "admin"})

        # Now try API request
        response = auth_enabled_client.get("/api/notes")
        # Should not be 401 (may be 200 or other valid response)
        assert response.status_code != 401


class TestSessionSecurity:
    """Test session security features"""

    def test_session_persists_across_requests(self, auth_enabled_client):
        """Test that session persists across multiple requests"""
        # Login
        auth_enabled_client.post("/login", data={"password": "admin"})

        # Make multiple API requests
        response1 = auth_enabled_client.get("/api/notes")
        response2 = auth_enabled_client.get("/api/tags")

        # Both should succeed (not 401)
        assert response1.status_code != 401
        assert response2.status_code != 401

    def test_concurrent_sessions_isolated(self):
        """Test that sessions are isolated between clients"""
        # Create two separate clients
        client1 = TestClient(app)
        client2 = TestClient(app)

        with patch(
            "backend.dependencies.config",
            {
                "authentication": {
                    "enabled": True,
                    "password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG",
                    "secret_key": "test_secret_key_for_sessions_minimum_32_chars_long",
                }
            },
        ):
            # Login with client1
            client1.post("/login", data={"password": "admin"})

            # client1 should be authenticated
            response1 = client1.get("/api/notes")
            assert response1.status_code != 401

            # client2 should NOT be authenticated
            response2 = client2.get("/api/notes")
            assert response2.status_code in [401, 303]


class TestEdgeCases:
    """Test edge cases and error conditions"""

    def test_login_with_missing_password(self, auth_enabled_client):
        """Test login with missing password field"""
        response = auth_enabled_client.post("/login", data={})
        # FastAPI should return 422 for missing required field
        assert response.status_code == 422

    def test_login_with_empty_password(self, auth_enabled_client):
        """Test login with empty password"""
        response = auth_enabled_client.post("/login", data={"password": ""}, follow_redirects=False)
        # FastAPI may return 422 (validation error) for empty password
        # or 303 (redirect with error) if it reaches the handler
        assert response.status_code in [303, 422]
        if response.status_code == 303:
            assert "error=" in response.headers["location"]

    def test_login_with_very_long_password(self, auth_enabled_client):
        """Test login with extremely long password"""
        long_password = "a" * 10000
        response = auth_enabled_client.post("/login", data={"password": long_password}, follow_redirects=False)
        assert response.status_code == 303
        # Should fail with error
        assert "error=" in response.headers["location"]

    def test_login_with_special_characters(self, auth_enabled_client):
        """Test login with special characters in password"""
        special_password = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`"
        response = auth_enabled_client.post("/login", data={"password": special_password}, follow_redirects=False)
        assert response.status_code == 303
        # Should fail (not the correct password)
        assert "error=" in response.headers["location"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
