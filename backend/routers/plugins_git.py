"""
Granite - Git Plugin Routes
Handles Git sync plugin settings and operations.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.config import user_settings_path
from backend.core.decorators import handle_errors
from backend.core.rate_limits import RATE_LIMITS
from backend.dependencies import limiter, plugin_manager, require_auth
from backend.services import update_user_setting

router = APIRouter(
    prefix="/api/plugins/git",
    dependencies=[Depends(require_auth)],
    tags=["plugins-git"],
)


@router.get("/settings")
@handle_errors("Failed to get git plugin settings")
async def get_git_plugin_settings():
    """Get git plugin settings"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if hasattr(plugin, "get_settings"):
        return {"settings": plugin.get_settings()}
    return {"settings": {}}


@router.post("/settings")
@limiter.limit(RATE_LIMITS["plugin"])
@handle_errors("Failed to update git plugin settings")
async def update_git_plugin_settings(request: Request, settings: dict):
    """Update git plugin settings and persist to user-settings.json"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if hasattr(plugin, "update_settings"):
        plugin.update_settings(settings)

        # Persist to user-settings.json
        success, _ = update_user_setting(user_settings_path, "plugins", "git", plugin.get_settings())  # type: ignore[attr-defined]

        if not success:
            print("Warning: Failed to persist git plugin settings to user-settings.json")

        return {"success": True, "settings": plugin.get_settings()}  # type: ignore[attr-defined]
    raise HTTPException(status_code=400, detail="Git plugin does not support settings updates")


@router.get("/status")
@handle_errors("Failed to get git plugin status")
async def get_git_plugin_status():
    """Get git plugin status"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if hasattr(plugin, "get_status"):
        return plugin.get_status()
    return {"enabled": plugin.enabled}


@router.post("/manual-backup")
@limiter.limit(RATE_LIMITS["plugin_action"])
@handle_errors("Failed to trigger manual backup")
async def manual_git_backup(request: Request):
    """Manually trigger a git backup"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if not plugin.enabled:
        raise HTTPException(status_code=400, detail="Git plugin is not enabled")

    if hasattr(plugin, "manual_backup"):
        plugin.manual_backup()
        return {"success": True, "message": "Manual backup triggered"}
    raise HTTPException(status_code=400, detail="Git plugin does not support manual backup")


@router.post("/manual-pull")
@limiter.limit(RATE_LIMITS["plugin_action"])
@handle_errors("Failed to trigger manual pull")
async def manual_git_pull(request: Request):
    """Manually trigger a git pull"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if not plugin.enabled:
        raise HTTPException(status_code=400, detail="Git plugin is not enabled")

    if hasattr(plugin, "manual_pull"):
        plugin.manual_pull()
        return {"success": True, "message": "Manual pull triggered"}
    raise HTTPException(status_code=400, detail="Git plugin does not support manual pull")


@router.post("/ssh/generate")
@limiter.limit("3/hour")  # Limit SSH key generation to prevent abuse
@handle_errors("Failed to generate SSH key")
async def generate_ssh_key(request: Request, data: dict | None = None):
    """Generate SSH key for git authentication"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if not plugin.enabled:
        raise HTTPException(status_code=400, detail="Git plugin is not enabled")

    if hasattr(plugin, "generate_ssh_key"):
        # Accept email from request body, fallback to plugin settings, then default
        email = None

        # Try to get email from request body
        if data and isinstance(data, dict):
            email = data.get("email")

        # Fallback to plugin settings if not provided in request
        if not email and hasattr(plugin, "settings") and isinstance(plugin.settings, dict):
            email = plugin.settings.get("git_user_email")

        # Use default if still None or empty string
        if not email or not email.strip():
            email = "granite@localhost"

        # Basic email validation
        email = email.strip()
        if "@" not in email or len(email) < 3:
            raise HTTPException(status_code=400, detail="Invalid email format")

        success, message = plugin.generate_ssh_key(email)
        if success:
            return {"success": True, "message": message}
        raise HTTPException(status_code=400, detail=message)
    raise HTTPException(status_code=400, detail="Git plugin does not support SSH key generation")


@router.get("/ssh/public-key")
@handle_errors("Failed to get SSH public key")
async def get_ssh_public_key():
    """Get the SSH public key"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if not hasattr(plugin, "get_ssh_public_key"):
        raise HTTPException(status_code=400, detail="Git plugin does not support SSH public key retrieval")

    success, public_key = plugin.get_ssh_public_key()
    if success:
        # Ensure we return a valid string
        if not public_key or not isinstance(public_key, str):
            raise HTTPException(status_code=500, detail="Invalid public key format")
        return {"success": True, "public_key": public_key}
    # public_key contains error message in this case
    raise HTTPException(status_code=404, detail=public_key or "Public key not found")


@router.post("/ssh/test")
@limiter.limit(RATE_LIMITS["plugin"])
@handle_errors("Failed to test SSH connection")
async def test_ssh_connection(request: Request, data: dict | None = None):
    """Test SSH connection to git provider"""
    plugin = plugin_manager.plugins.get("git")
    if not plugin:
        raise HTTPException(status_code=404, detail="Git plugin not found")

    if not hasattr(plugin, "test_ssh_connection"):
        raise HTTPException(status_code=400, detail="Git plugin does not support SSH connection testing")

    # Get host from request, with validation
    host = "github.com"  # Default
    if data and isinstance(data, dict):
        provided_host = data.get("host")
        if provided_host and isinstance(provided_host, str):
            host = provided_host.strip()

    # Basic host validation
    if not host or len(host) < 3 or " " in host:
        raise HTTPException(status_code=400, detail="Invalid host format")

    success, message = plugin.test_ssh_connection(host)  # type: ignore[attr-defined]

    # Ensure message is a string
    if not isinstance(message, str):
        message = str(message) if message else "No message returned"

    return {"success": success, "message": message}
