"""
Granite - Configuration Management
Centralizes configuration loading and environment variable handling.
"""

# Configure Python logging based on DEBUG_MODE
import logging
import os
from pathlib import Path

import yaml  # type: ignore[import-untyped]

# Load configuration from config.yaml
config_path = Path(__file__).parent.parent / "config.yaml"
with config_path.open("r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

# User settings path (outside data folder, at root level)
user_settings_path = Path(__file__).parent.parent / "user-settings.json"

# Load version from VERSION file (single source of truth)
version_path = Path(__file__).parent.parent / "VERSION"
if not version_path.exists():
    raise FileNotFoundError("VERSION file not found. Please create it with the current version number.")
with version_path.open("r", encoding="utf-8") as f:
    version = f.read().strip()
    config["app"]["version"] = version

# Environment variable overrides for authentication settings
# Allows different configs for local vs production deployments
if "AUTHENTICATION_ENABLED" in os.environ:
    auth_enabled_env = os.getenv("AUTHENTICATION_ENABLED", "false").lower() in ("true", "1", "yes")
    config["authentication"]["enabled"] = auth_enabled_env
    print(f"Authentication {'ENABLED' if auth_enabled_env else 'DISABLED'} (from AUTHENTICATION_ENABLED env var)")
else:
    print(
        f"Authentication {'ENABLED' if config.get('authentication', {}).get('enabled', False) else 'DISABLED'} (from config.yaml)"
    )

# Allow password hash to be set via environment variable (useful for demos)
if "AUTHENTICATION_PASSWORD_HASH" in os.environ:
    config["authentication"]["password_hash"] = os.getenv("AUTHENTICATION_PASSWORD_HASH")
    print("Password hash loaded from AUTHENTICATION_PASSWORD_HASH env var")

# Allow secret key to be set via environment variable (for session security)
if "AUTHENTICATION_SECRET_KEY" in os.environ:
    config["authentication"]["secret_key"] = os.getenv("AUTHENTICATION_SECRET_KEY")
    print("Secret key loaded from AUTHENTICATION_SECRET_KEY env var")

# Demo mode - Centralizes all demo-specific restrictions
# When DEMO_MODE=true, enables rate limiting and other demo protections
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")

if DEMO_MODE:
    print("DEMO MODE enabled - Rate limiting active")

# Debug mode - Controls logging throughout the application
# When DEBUG_MODE=true, enables all logging (backend and frontend)
# When false, all logging is suppressed
if "DEBUG_MODE" in os.environ:
    DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() in ("true", "1", "yes")
else:
    DEBUG_MODE = config.get("server", {}).get("debug", False)

if DEBUG_MODE:
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    print("DEBUG MODE enabled - Logging active")
else:
    # Suppress all logging when debug mode is off
    logging.basicConfig(level=logging.CRITICAL + 1)
    # Also suppress uvicorn access logs
    logging.getLogger("uvicorn.access").setLevel(logging.CRITICAL + 1)
    logging.getLogger("uvicorn.error").setLevel(logging.CRITICAL + 1)

# CORS configuration
allowed_origins = config.get("server", {}).get("allowed_origins", ["*"])
print(f"CORS allowed origins: {allowed_origins}")

# Static paths
static_path = Path(__file__).parent.parent / "frontend"
