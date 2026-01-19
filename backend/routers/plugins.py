"""
Granite - Plugin Routes (General)
Handles general plugin management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.dependencies import limiter, plugin_manager, require_auth, safe_error_message

router = APIRouter(
    prefix="/api/plugins",
    dependencies=[Depends(require_auth)],
    tags=["plugins"],
)


@router.get("")
async def list_plugins():
    """List all available plugins"""
    return {"plugins": plugin_manager.list_plugins()}


@router.get("/note_stats/calculate")
async def calculate_note_stats(content: str):
    """Calculate statistics for note content (if plugin enabled)"""
    try:
        plugin = plugin_manager.plugins.get("note_stats")
        if not plugin or not plugin.enabled:
            return {"enabled": False, "stats": None}

        stats = plugin.calculate_stats(content)  # type: ignore[attr-defined]
        return {"enabled": True, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to calculate note statistics")) from e


@router.post("/{plugin_name}/toggle")
@limiter.limit("10/minute")
async def toggle_plugin(request: Request, plugin_name: str, enabled: dict):
    """Enable or disable a plugin"""
    try:
        is_enabled = enabled.get("enabled", False)
        if is_enabled:
            plugin_manager.enable_plugin(plugin_name)
        else:
            plugin_manager.disable_plugin(plugin_name)

        return {"success": True, "plugin": plugin_name, "enabled": is_enabled}
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to toggle plugin")) from e
