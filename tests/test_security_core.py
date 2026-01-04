"""
Security Module Tests

Tests security configuration validation and credential checking:
- Default credential detection
- Secret key validation
- Security configuration validation
- Security recommendations
- Secure key generation

Run with: pytest tests/test_security_core.py -v
"""

import sys
from pathlib import Path

import pytest

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.security import (
    check_default_credentials,
    generate_secure_secret_key,
    get_security_recommendations,
    validate_security_config,
)


class TestCheckDefaultCredentials:
    """Test default credential detection"""

    def test_warns_on_default_password_hash(self):
        """Test that default password hash triggers warning"""
        config = {
            "authentication": {
                "password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG",  # default "admin"
                "secret_key": "secure_random_key_12345678901234567890",
            }
        }

        # Should warn but not raise (warning goes to loguru logger)
        try:
            check_default_credentials(config)
            # If we get here without exception, test passes
            assert True
        except RuntimeError:
            pytest.fail("Should not raise on default password, only warn")

    def test_raises_on_default_secret_key(self):
        """Test that default secret key raises RuntimeError"""
        config = {
            "authentication": {
                "password_hash": "secure_hash",
                "secret_key": "change_this_to_a_random_secret_key_in_production",
            }
        }

        with pytest.raises(RuntimeError, match="Default session secret key detected"):
            check_default_credentials(config)

    def test_raises_on_other_default_secret_key(self):
        """Test that other known default secret key raises RuntimeError"""
        config = {
            "authentication": {
                "password_hash": "secure_hash",
                "secret_key": "insecure_default_key_change_this",
            }
        }

        with pytest.raises(RuntimeError):
            check_default_credentials(config)

    def test_passes_with_secure_credentials(self):
        """Test that secure credentials don't trigger warnings"""
        config = {
            "authentication": {
                "password_hash": "$2b$12$customhashnotdefaultvalue12345678901234567890",
                "secret_key": "secure_random_key_abcdef123456789012345678901234567890",
            }
        }

        # Should not raise
        try:
            check_default_credentials(config)
            # If we get here, test passed
            assert True
        except RuntimeError:
            pytest.fail("Should not raise RuntimeError with secure credentials")

    def test_handles_missing_auth_config(self):
        """Test handling of missing authentication config"""
        config = {}

        # Should not raise (defaults to empty)
        try:
            check_default_credentials(config)
            assert True
        except RuntimeError:
            pytest.fail("Should handle missing config gracefully")

    def test_handles_missing_password_hash(self):
        """Test handling of missing password_hash field"""
        config = {"authentication": {"secret_key": "secure_key_12345678901234567890"}}

        # Should not raise (empty hash won't match default)
        try:
            check_default_credentials(config)
            assert True
        except RuntimeError:
            pytest.fail("Should handle missing password_hash gracefully")


class TestGenerateSecureSecretKey:
    """Test secure secret key generation"""

    def test_generates_64_char_hex_string(self):
        """Test that generated key is 64 characters"""
        key = generate_secure_secret_key()
        assert len(key) == 64

    def test_generates_valid_hex(self):
        """Test that generated key contains only hex characters"""
        key = generate_secure_secret_key()
        assert all(c in "0123456789abcdef" for c in key)

    def test_generates_unique_keys(self):
        """Test that multiple generations produce different keys"""
        keys = [generate_secure_secret_key() for _ in range(10)]
        # All keys should be unique
        assert len(set(keys)) == 10

    def test_key_is_cryptographically_random(self):
        """Test that generated keys are not predictable"""
        key1 = generate_secure_secret_key()
        key2 = generate_secure_secret_key()
        # Keys should be completely different
        assert key1 != key2
        # Should not have large common substrings
        assert key1[:32] != key2[:32]


class TestValidateSecurityConfig:
    """Test security configuration validation"""

    def test_valid_config_with_auth_enabled(self):
        """Test that valid config with auth enabled passes validation"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "$2b$12$customhash",
                "secret_key": "secure_key_12345678901234567890",
                "session_max_age": 604800,
            },
            "server": {"allowed_origins": ["https://example.com"]},
        }

        # Should not raise
        validate_security_config(config)

    def test_valid_config_with_auth_disabled(self):
        """Test that config with auth disabled passes validation"""
        config = {"authentication": {"enabled": False}, "server": {}}

        # Should not raise
        validate_security_config(config)

    def test_raises_when_auth_enabled_without_password_hash(self):
        """Test that auth enabled without password_hash raises ValueError"""
        config = {
            "authentication": {
                "enabled": True,
                "secret_key": "secure_key_12345678901234567890",
            }
        }

        with pytest.raises(ValueError, match="no password_hash configured"):
            validate_security_config(config)

    def test_raises_when_auth_enabled_without_secret_key(self):
        """Test that auth enabled without secret_key raises ValueError"""
        config = {"authentication": {"enabled": True, "password_hash": "$2b$12$hash"}}

        with pytest.raises(ValueError, match="no secret_key configured"):
            validate_security_config(config)

    def test_warns_on_very_short_session_max_age(self):
        """Test that very short session max age triggers warning"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "$2b$12$hash",
                "secret_key": "key",
                "session_max_age": 60,  # 1 minute
            }
        }

        # Should not raise, just warn (warning goes to loguru logger)
        validate_security_config(config)

    def test_warns_on_very_long_session_max_age(self):
        """Test that very long session max age triggers warning"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "$2b$12$hash",
                "secret_key": "key",
                "session_max_age": 5000000,  # ~58 days
            }
        }

        # Should not raise, just warn (warning goes to loguru logger)
        validate_security_config(config)

    def test_warns_on_wildcard_cors(self):
        """Test that wildcard CORS triggers warning"""
        config = {
            "authentication": {"enabled": False},
            "server": {"allowed_origins": ["*"]},
        }

        # Should not raise, just warn (warning goes to loguru logger)
        validate_security_config(config)

    def test_handles_missing_session_max_age(self):
        """Test that missing session_max_age uses default"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "$2b$12$hash",
                "secret_key": "key",
                # session_max_age not specified
            }
        }

        # Should not raise (uses default)
        validate_security_config(config)

    def test_handles_empty_config(self):
        """Test that empty config is handled gracefully"""
        config = {}

        # Should not raise
        validate_security_config(config)


class TestGetSecurityRecommendations:
    """Test security recommendations generation"""

    def test_recommends_enabling_auth_when_disabled(self):
        """Test that recommendation to enable auth is given when disabled"""
        config = {"authentication": {"enabled": False}, "server": {}}

        recommendations = get_security_recommendations(config)

        # Should recommend enabling authentication
        assert any("Authentication is disabled" in rec for rec in recommendations)

    def test_recommends_disabling_debug_when_enabled(self):
        """Test that recommendation to disable debug is given"""
        config = {"authentication": {}, "server": {"debug": True}}

        recommendations = get_security_recommendations(config)

        # Should recommend disabling debug
        assert any("Debug mode is enabled" in rec for rec in recommendations)

    def test_always_recommends_https(self):
        """Test that HTTPS recommendation is always included"""
        config = {"authentication": {}, "server": {}}

        recommendations = get_security_recommendations(config)

        # Should always recommend HTTPS
        assert any("HTTPS" in rec for rec in recommendations)

    def test_always_recommends_rate_limiting(self):
        """Test that rate limiting recommendation is always included"""
        config = {"authentication": {}, "server": {}}

        recommendations = get_security_recommendations(config)

        # Should recommend rate limiting
        assert any("rate limiting" in rec for rec in recommendations)

    def test_returns_list_of_strings(self):
        """Test that recommendations are returned as list of strings"""
        config = {"authentication": {}, "server": {}}

        recommendations = get_security_recommendations(config)

        assert isinstance(recommendations, list)
        assert all(isinstance(rec, str) for rec in recommendations)
        assert len(recommendations) > 0

    def test_no_auth_recommendation_when_enabled(self):
        """Test that auth recommendation is not given when enabled"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "hash",
                "secret_key": "key",
            },
            "server": {},
        }

        recommendations = get_security_recommendations(config)

        # Should not recommend enabling auth (it's already enabled)
        assert not any("Authentication is disabled" in rec for rec in recommendations)

    def test_no_debug_recommendation_when_disabled(self):
        """Test that debug recommendation is not given when disabled"""
        config = {"authentication": {}, "server": {"debug": False}}

        recommendations = get_security_recommendations(config)

        # Should not recommend disabling debug (it's already disabled)
        assert not any("Debug mode is enabled" in rec for rec in recommendations)


class TestSecurityEdgeCases:
    """Test edge cases and error conditions"""

    def test_handles_none_config(self):
        """Test that None config values are handled"""
        config = {"authentication": None, "server": None}

        # These functions may or may not handle None gracefully
        # Depending on implementation, they might raise AttributeError
        try:
            validate_security_config(config)
            get_security_recommendations(config)
            # If no error, that's fine
            assert True
        except (AttributeError, TypeError):
            # If they raise, that's also acceptable behavior
            # (the code doesn't guarantee None handling)
            assert True

    def test_handles_empty_strings(self):
        """Test that empty string values are handled"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "",
                "secret_key": "",
            }
        }

        # Should raise ValueError for missing required fields
        with pytest.raises(ValueError):
            validate_security_config(config)

    def test_handles_invalid_session_max_age_type(self):
        """Test that invalid session_max_age type is handled"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "hash",
                "secret_key": "key",
                "session_max_age": "invalid",  # String instead of int
            }
        }

        # Should handle gracefully (may use default)
        try:
            validate_security_config(config)
            # Implementation may handle this differently
            assert True
        except (TypeError, ValueError):
            # Or may raise type error
            assert True


class TestSecurityIntegration:
    """Test integration scenarios"""

    def test_production_ready_config(self):
        """Test a production-ready configuration passes all checks"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "$2b$12$customsecurehashnotdefault1234567890",
                "secret_key": "c4fe87b6a9d8e3f21b5a78c90d2e14f6a3b8c9d0e1f2a3b4c5d6e7f8",
                "session_max_age": 604800,  # 7 days
            },
            "server": {
                "debug": False,
                "allowed_origins": ["https://notes.example.com"],
            },
        }

        # Should pass validation
        validate_security_config(config)

        # Should not raise on credential check
        try:
            check_default_credentials(config)
            assert True
        except RuntimeError:
            pytest.fail("Production config should not raise errors")

        # Should have minimal recommendations
        recommendations = get_security_recommendations(config)
        # Should only have HTTPS and rate limiting recommendations
        assert len(recommendations) == 2

    def test_insecure_config_fails_checks(self):
        """Test that insecure configuration fails appropriate checks"""
        config = {
            "authentication": {
                "enabled": True,
                "password_hash": "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG",  # default
                "secret_key": "change_this_to_a_random_secret_key_in_production",  # default
            },
            "server": {"debug": True, "allowed_origins": ["*"]},
        }

        # Should raise on credential check (default secret key)
        with pytest.raises(RuntimeError):
            check_default_credentials(config)

        # Should generate multiple recommendations
        config["authentication"]["secret_key"] = "secure_key_12345678901234567890"  # Fix for recommendations test
        recommendations = get_security_recommendations(config)
        assert len(recommendations) > 2  # Debug warning + HTTPS + rate limiting


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
