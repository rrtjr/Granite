"""
Security utilities and checks for Granite
"""

import secrets

from loguru import logger


def check_default_credentials(config: dict) -> None:
    """
    Check if default credentials are in use and warn/error appropriately

    Args:
        config: Application configuration dictionary

    Raises:
        RuntimeError: If default secret key is in use (critical security issue)
    """
    auth_config = config.get("authentication", {})

    # Check for default password hash
    default_password_hash = "$2b$12$t/6PGExFzdpU2PUta0iVY.eDQwvu63kH.c/d4bEnnHaQ5CspH1yrG"
    current_hash = auth_config.get("password_hash", "")

    if current_hash == default_password_hash:
        logger.warning("")
        logger.warning("=" * 80)
        logger.warning("SECURITY WARNING: Default password 'admin' is in use!")
        logger.warning("   Please change this immediately by running:")
        logger.warning("   python generate_password.py")
        logger.warning("   Then update config.yaml or set AUTHENTICATION_PASSWORD_HASH")
        logger.warning("=" * 80)
        logger.warning("")

    # Check for default secret key
    default_secret_keys = ["change_this_to_a_random_secret_key_in_production", "insecure_default_key_change_this"]
    current_secret = auth_config.get("secret_key", "")

    if current_secret in default_secret_keys:
        logger.error("")
        logger.error("=" * 80)
        logger.error("CRITICAL SECURITY ERROR: Default session secret key detected!")
        logger.error("   This is a CRITICAL security vulnerability.")
        logger.error("   Generate a secure secret key:")
        logger.error('   python -c "import secrets; print(secrets.token_hex(32))"')
        logger.error("   Then set AUTHENTICATION_SECRET_KEY environment variable")
        logger.error("   or update config.yaml")
        logger.error("=" * 80)
        logger.error("")

        # Raise error to prevent startup
        raise RuntimeError(
            "Default session secret key detected. "
            "Set AUTHENTICATION_SECRET_KEY or update config.yaml with a secure random key."
        )


def generate_secure_secret_key() -> str:
    """
    Generate a cryptographically secure random secret key

    Returns:
        64-character hexadecimal string
    """
    return secrets.token_hex(32)


def validate_security_config(config: dict) -> None:
    """
    Validate security-related configuration settings

    Args:
        config: Application configuration dictionary

    Raises:
        ValueError: If configuration is invalid or insecure
    """
    auth_config = config.get("authentication", {})

    # If authentication is enabled, validate required fields
    if auth_config.get("enabled", False):
        if not auth_config.get("password_hash"):
            raise ValueError("Authentication enabled but no password_hash configured")

        if not auth_config.get("secret_key"):
            raise ValueError("Authentication enabled but no secret_key configured")

        # Validate session max age (should be reasonable)
        max_age = auth_config.get("session_max_age", 604800)
        if max_age < 300:  # 5 minutes
            logger.warning(f"Session max age is very short: {max_age} seconds")
        elif max_age > 2592000:  # 30 days
            logger.warning(f"Session max age is very long: {max_age} seconds (30+ days)")

    # Validate CORS settings
    server_config = config.get("server", {})
    allowed_origins = server_config.get("allowed_origins", [])

    if "*" in allowed_origins:
        logger.warning("CORS is set to allow all origins (*). This is fine for self-hosted use,")
        logger.warning("but consider restricting to specific domains in production environments.")


def get_security_recommendations(config: dict) -> list[str]:
    """
    Get a list of security recommendations based on current configuration

    Args:
        config: Application configuration dictionary

    Returns:
        List of recommendation strings
    """
    recommendations = []

    auth_config = config.get("authentication", {})
    server_config = config.get("server", {})

    # Check if authentication is disabled
    if not auth_config.get("enabled", False):
        recommendations.append(
            "Authentication is disabled. Enable it if exposing to the internet:\n"
            "   Set authentication.enabled: true in config.yaml"
        )

    # Check if debug mode is enabled
    if server_config.get("debug", False):
        recommendations.append(
            "Debug mode is enabled. Disable in production:\n   Set server.debug: false in config.yaml"
        )

    # Check HTTPS usage
    recommendations.append("Ensure you're using HTTPS in production (via reverse proxy like nginx/caddy)")

    # Check rate limiting
    recommendations.append(
        "Consider enabling rate limiting for production deployments:\n   Set DEMO_MODE=true environment variable"
    )

    return recommendations
