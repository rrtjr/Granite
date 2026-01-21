"""
Granite - Configuration and Settings Routes
Handles app configuration and user settings endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.config import DEMO_MODE, config, config_path, user_settings_path
from backend.core.decorators import handle_errors
from backend.core.rate_limits import RATE_LIMITS
from backend.dependencies import get_templates_dir, limiter, require_auth
from backend.services import (
    load_user_settings,
    save_user_settings,
    update_config_value,
)

router = APIRouter(
    prefix="/api",
    dependencies=[Depends(require_auth)],
    tags=["config"],
)


@router.get("")
async def api_documentation():
    """API Documentation - List all available endpoints"""
    return {
        "app": {
            "name": config["app"]["name"],
            "version": config["app"]["version"],
            "description": config["app"]["tagline"],
        },
        "endpoints": [
            {
                "method": "GET",
                "path": "/api",
                "description": "API documentation - lists all available endpoints",
                "response": "API documentation object",
            },
            {
                "method": "GET",
                "path": "/api/config",
                "description": "Get application configuration",
                "response": "{ name, tagline, version, searchEnabled }",
            },
            {
                "method": "GET",
                "path": "/api/themes",
                "description": "List all available themes",
                "response": "{ themes: [{ id, name, builtin }] }",
            },
            {
                "method": "GET",
                "path": "/api/themes/{theme_id}",
                "description": "Get CSS content for a specific theme",
                "parameters": {"theme_id": "Theme identifier (e.g., 'dark', 'light', 'dracula')"},
                "response": "{ css, theme_id }",
            },
            {
                "method": "GET",
                "path": "/api/notes",
                "description": "List all notes and folders",
                "response": "{ notes: [{ path, name, folder }], folders: [path] }",
            },
            {
                "method": "GET",
                "path": "/api/notes/{note_path}",
                "description": "Get content of a specific note",
                "parameters": {"note_path": "Path to note (e.g., 'test.md', 'folder/note.md')"},
                "response": "{ content }",
            },
            {
                "method": "POST",
                "path": "/api/notes/{note_path}",
                "description": "Create or update a note",
                "parameters": {"note_path": "Path to note"},
                "body": {"content": "Markdown content of the note"},
                "response": "{ success, message }",
            },
            {
                "method": "DELETE",
                "path": "/api/notes/{note_path}",
                "description": "Delete a note",
                "parameters": {"note_path": "Path to note"},
                "response": "{ success, message }",
            },
            {
                "method": "POST",
                "path": "/api/notes/move",
                "description": "Move a note to a different location",
                "body": {"oldPath": "Current note path", "newPath": "New note path"},
                "response": "{ success, oldPath, newPath }",
            },
            {
                "method": "POST",
                "path": "/api/folders",
                "description": "Create a new folder",
                "body": {"path": "Folder path (e.g., 'Projects', 'Work/2025')"},
                "response": "{ success, path }",
            },
            {
                "method": "POST",
                "path": "/api/folders/move",
                "description": "Move a folder to a different location",
                "body": {"oldPath": "Current folder path", "newPath": "New folder path"},
                "response": "{ success, oldPath, newPath }",
            },
            {
                "method": "POST",
                "path": "/api/folders/rename",
                "description": "Rename a folder",
                "body": {"oldPath": "Current folder path", "newPath": "New folder path"},
                "response": "{ success, oldPath, newPath }",
            },
            {
                "method": "GET",
                "path": "/api/tags",
                "description": "Get all tags used across all notes with their counts",
                "response": "{ tags: { tag_name: count, ... } }",
            },
            {
                "method": "GET",
                "path": "/api/tags/{tag_name}",
                "description": "Get all notes that have a specific tag",
                "parameters": {"tag_name": "Tag to filter by (case-insensitive)"},
                "response": "{ tag, count, notes: [{ path, name, folder, tags }] }",
            },
            {
                "method": "GET",
                "path": "/api/search",
                "description": "Search notes by content",
                "parameters": {"q": "Search query string"},
                "response": "{ results: [{ path, name, folder, snippet }], query }",
            },
            {
                "method": "GET",
                "path": "/api/graph",
                "description": "Get graph data for note visualization",
                "response": "{ nodes: [{ id, label }], edges: [] }",
            },
            {
                "method": "GET",
                "path": "/api/plugins",
                "description": "List all loaded plugins",
                "response": "{ plugins: [{ id, name, version, enabled }] }",
            },
            {
                "method": "POST",
                "path": "/api/plugins/{plugin_name}/toggle",
                "description": "Enable or disable a plugin",
                "parameters": {"plugin_name": "Plugin identifier"},
                "body": {"enabled": "true/false"},
                "response": "{ success, plugin, enabled }",
            },
            {
                "method": "GET",
                "path": "/health",
                "description": "Health check endpoint",
                "response": "{ status: 'healthy', app, version }",
            },
        ],
        "notes": {
            "authentication": "Not required (add authentication in config.yaml if needed)",
            "base_url": "http://localhost:8000",
            "content_type": "application/json",
            "cors": "Enabled for all origins",
        },
        "examples": {
            "create_note": {
                "curl": "curl -X POST http://localhost:8000/api/notes/test.md -H 'Content-Type: application/json' -d '{\"content\": \"# Hello World\"}'",
                "description": "Create a new note named test.md",
            },
            "search_notes": {
                "curl": "curl http://localhost:8000/api/search?q=hello",
                "description": "Search for notes containing 'hello'",
            },
            "list_themes": {"curl": "curl http://localhost:8000/api/themes", "description": "Get all available themes"},
            "enable_plugin": {
                "curl": "curl -X POST http://localhost:8000/api/plugins/git_backup/toggle -H 'Content-Type: application/json' -d '{\"enabled\": true}'",
                "description": "Enable the git_backup plugin",
            },
        },
    }


@router.get("/config")
async def get_config():
    """Get app configuration for frontend"""
    return {
        "name": config["app"]["name"],
        "tagline": config["app"]["tagline"],
        "version": config["app"]["version"],
        "searchEnabled": config["search"]["enabled"],
        "demoMode": DEMO_MODE,  # Expose demo mode flag to frontend
        "authentication": {"enabled": config.get("authentication", {}).get("enabled", False)},
    }


@router.get("/settings/templates-dir")
@limiter.limit(RATE_LIMITS["write"])
@handle_errors("Failed to get templates directory")
async def get_templates_dir_setting(request: Request):
    """Get the current templates directory path (relative to notes_dir)"""
    return {"templatesDir": get_templates_dir()}


@router.post("/settings/templates-dir")
@limiter.limit(RATE_LIMITS["write_moderate"])
@handle_errors("Failed to update templates directory")
async def update_templates_dir(request: Request, data: dict):
    """
    Update the templates directory path.
    Updates both in-memory config, config.yaml file, and user-settings.json.

    Args:
        data: Dictionary containing templatesDir

    Returns:
        Success status and new path
    """
    templates_dir = data.get("templatesDir", "")

    if not templates_dir:
        raise HTTPException(status_code=400, detail="Templates directory path is required")

    # Update in-memory config (hot-swap - no restart needed)
    config["storage"]["templates_dir"] = templates_dir

    # Update config.yaml for persistence
    success = update_config_value(config_path, "storage.templates_dir", templates_dir)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update config file")

    # Also update user-settings.json to keep them in sync
    current_user_settings = load_user_settings(user_settings_path)
    if "paths" not in current_user_settings:
        current_user_settings["paths"] = {}
    current_user_settings["paths"]["templatesDir"] = templates_dir
    save_user_settings(user_settings_path, current_user_settings)

    return {"success": True, "templatesDir": templates_dir, "message": "Templates directory updated successfully"}


@router.get("/settings/user")
@limiter.limit(RATE_LIMITS["read"])
@handle_errors("Failed to load user settings")
async def get_user_settings(request: Request):
    """
    Get all user settings (reading preferences, performance settings, paths).
    Settings are stored in user-settings.json at root level.
    Falls back to config.yaml for templatesDir if not in user settings.
    """
    settings = load_user_settings(user_settings_path)

    # Ensure templatesDir is present, falling back to config.yaml
    if "paths" not in settings:
        settings["paths"] = {}
    if "templatesDir" not in settings["paths"]:
        settings["paths"]["templatesDir"] = config["storage"].get("templates_dir", "_templates")

    return settings


@router.post("/settings/user")
@limiter.limit(RATE_LIMITS["write"])
@handle_errors("Failed to update user settings")
async def update_user_settings_endpoint(request: Request, data: dict):
    """
    Update user settings. Accepts partial updates.

    Request body example:
    {
      "reading": {"width": "medium"},
      "performance": {"autosaveDelay": 2000},
      "paths": {"templatesDir": "my_templates"}
    }
    """
    # Load current settings
    current_settings = load_user_settings(user_settings_path)

    # Update with provided values (merge)
    for section, values in data.items():
        if isinstance(values, dict):
            # For dict values, merge with existing section
            if section not in current_settings:
                current_settings[section] = {}
            current_settings[section].update(values)
        else:
            # For non-dict values (like favorites array), replace directly
            current_settings[section] = values

    # Save updated settings
    success = save_user_settings(user_settings_path, current_settings)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save user settings")

    # Update in-memory config for templates_dir if changed
    if "paths" in data and "templatesDir" in data["paths"]:
        config["storage"]["templates_dir"] = data["paths"]["templatesDir"]
        # Also update config.yaml for persistence
        update_config_value(config_path, "storage.templates_dir", data["paths"]["templatesDir"])

    return {"success": True, "settings": current_settings, "message": "User settings updated successfully"}
