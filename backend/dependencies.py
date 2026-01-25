"""
Granite - Shared Dependencies
Provides shared dependencies like authentication, rate limiting, and plugin management.
"""

import bcrypt
from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import DEMO_MODE, config, user_settings_path
from .plugins import PluginManager
from .utils import ensure_directories, load_user_settings


def safe_error_message(error: Exception, user_message: str = "An error occurred") -> str:
    """
    Return safe error message for API responses.
    In debug mode, returns full error details.
    In production, returns generic message and logs full details server-side.

    Args:
        error: The caught exception
        user_message: User-friendly message to show in production

    Returns:
        Safe error message string
    """
    error_details = f"{type(error).__name__}: {error!s}"
    print(f"[ERROR] {error_details}")

    if config.get("server", {}).get("debug", False):
        return error_details

    return user_message


if DEMO_MODE:
    limiter = Limiter(key_func=get_remote_address, default_limits=["200/hour"])
else:

    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

    limiter = DummyLimiter()  # type: ignore[assignment]


ensure_directories(config)


def get_templates_dir() -> str:
    """
    Get the templates directory path, preferring user-settings.json over config.yaml.
    This allows templates_dir to be updated at runtime without server restart.

    Returns:
        Templates directory path (relative or absolute)
    """
    try:
        user_settings = load_user_settings(user_settings_path)
        templates_dir = user_settings.get("paths", {}).get("templatesDir")
        if templates_dir:
            return str(templates_dir)
    except Exception:  # nosec B110
        pass

    return str(config["storage"].get("templates_dir", "_templates"))


plugin_manager = PluginManager(config["storage"]["plugins_dir"])

_user_settings = load_user_settings(user_settings_path)
_plugins = _user_settings.get("plugins")
if _plugins:
    for plugin_name, plugin_settings in _plugins.items():
        plugin = plugin_manager.plugins.get(plugin_name)
        if plugin and hasattr(plugin, "update_settings"):
            plugin.update_settings(plugin_settings)
            print(f"Loaded settings for plugin: {plugin_name}")

plugin_manager.run_hook("on_app_startup")


def auth_enabled() -> bool:
    """Check if authentication is enabled in config"""
    return bool(config.get("authentication", {}).get("enabled", False))


async def require_auth(request: Request):
    """Dependency to require authentication on protected routes"""
    if not auth_enabled():
        return

    if not request.session.get("authenticated"):
        raise HTTPException(status_code=401, detail="Not authenticated")


def verify_password(password: str) -> bool:
    """Verify password against stored hash"""
    password_hash = config.get("authentication", {}).get("password_hash", "")
    if not password_hash:
        return False

    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception as e:
        print(f"Password verification error: {e}")
        return False
