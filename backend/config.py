"""
Granite - Configuration Management
Centralizes configuration loading and environment variable handling.
"""

import logging
import os
import sys
from pathlib import Path

import yaml  # type: ignore[import-untyped]
from loguru import logger

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

# Debug mode - Controls logging throughout the application
# When DEBUG_MODE=true, enables all logging (backend and frontend)
# When false, all logging is suppressed
# NOTE: Determined early so we can control startup message visibility
if "DEBUG_MODE" in os.environ:
    DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() in ("true", "1", "yes")
else:
    DEBUG_MODE = config.get("server", {}).get("debug", False)

# Demo mode - Centralizes all demo-specific restrictions
# When DEMO_MODE=true, enables rate limiting and other demo protections
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")

# Environment variable overrides for authentication settings
# Allows different configs for local vs production deployments
if "AUTHENTICATION_ENABLED" in os.environ:
    auth_enabled_env = os.getenv("AUTHENTICATION_ENABLED", "false").lower() in ("true", "1", "yes")
    config["authentication"]["enabled"] = auth_enabled_env

# Allow password hash to be set via environment variable (useful for demos)
if "AUTHENTICATION_PASSWORD_HASH" in os.environ:
    config["authentication"]["password_hash"] = os.getenv("AUTHENTICATION_PASSWORD_HASH")

# Allow secret key to be set via environment variable (for session security)
if "AUTHENTICATION_SECRET_KEY" in os.environ:
    config["authentication"]["secret_key"] = os.getenv("AUTHENTICATION_SECRET_KEY")


# Configure loguru based on DEBUG_MODE
class InterceptHandler(logging.Handler):
    """Intercept standard logging and redirect to loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        # Get corresponding Loguru level if it exists
        level: str | int
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


# Remove default loguru handler
logger.remove()

if DEBUG_MODE:
    # Add stderr handler with nice formatting when debug is enabled
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="DEBUG",
        colorize=True,
    )
    logger.info("DEBUG MODE enabled - Logging active")

    # Log startup configuration
    auth_enabled = config.get("authentication", {}).get("enabled", False)
    logger.info(f"Authentication {'ENABLED' if auth_enabled else 'DISABLED'}")
    if DEMO_MODE:
        logger.info("DEMO MODE enabled - Rate limiting active")

    # Intercept standard library logging (for uvicorn, etc.)
    logging.basicConfig(handlers=[InterceptHandler()], level=logging.DEBUG, force=True)
else:
    # When debug is off, disable all logging
    logger.add(sys.stderr, level="CRITICAL")
    # Suppress standard library logging
    logging.basicConfig(level=logging.CRITICAL + 1, force=True)
    logging.getLogger("uvicorn.access").setLevel(logging.CRITICAL + 1)
    logging.getLogger("uvicorn.error").setLevel(logging.CRITICAL + 1)

# CORS configuration
allowed_origins = config.get("server", {}).get("allowed_origins", ["*"])
if DEBUG_MODE:
    logger.info(f"CORS allowed origins: {allowed_origins}")

# Static paths
static_path = Path(__file__).parent.parent / "frontend"
