"""
Granite - Template Routes
Handles template listing, retrieval, and note creation from templates.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.config import config, user_settings_path
from backend.core.decorators import handle_errors
from backend.core.rate_limits import RATE_LIMITS
from backend.dependencies import get_templates_dir, limiter, plugin_manager, require_auth
from backend.services import (
    apply_template_placeholders,
    get_template_content,
    get_templates,
    load_user_settings,
    save_note,
)

router = APIRouter(
    prefix="/api/templates",
    dependencies=[Depends(require_auth)],
    tags=["templates"],
)


@router.get("")
@limiter.limit(RATE_LIMITS["read"])
@handle_errors("Failed to list templates")
async def list_templates(request: Request):
    """
    List all available templates from templates folder.

    Returns:
        List of template metadata
    """
    notes_dir = config["storage"]["notes_dir"]
    templates_dir = get_templates_dir()
    templates = get_templates(notes_dir, templates_dir)

    return {"templates": templates}


@router.get("/{template_name}")
@limiter.limit(RATE_LIMITS["read"])
@handle_errors("Failed to get template")
async def get_template(request: Request, template_name: str):
    """
    Get content of a specific template.

    Args:
        template_name: Name of the template (without .md extension)

    Returns:
        Template name and content
    """
    content = get_template_content(config["storage"]["notes_dir"], template_name, get_templates_dir())

    if content is None:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"name": template_name, "content": content}


@router.post("/create-note")
@limiter.limit(RATE_LIMITS["write"])
@handle_errors("Failed to create note from template")
async def create_note_from_template(request: Request, data: dict):
    """
    Create a new note from a template with placeholder replacement.

    Args:
        data: Dictionary containing templateName and notePath

    Returns:
        Success status, path, and created content
    """
    template_name = data.get("templateName", "")
    note_path = data.get("notePath", "")

    if not template_name or not note_path:
        raise HTTPException(status_code=400, detail="Template name and note path required")

    # Get template content
    template_content = get_template_content(config["storage"]["notes_dir"], template_name, get_templates_dir())

    if template_content is None:
        raise HTTPException(status_code=404, detail="Template not found")

    user_settings = load_user_settings(user_settings_path)
    final_content = apply_template_placeholders(template_content, note_path, user_settings)

    final_content = plugin_manager.run_hook_with_return(
        "on_note_create", note_path=note_path, initial_content=final_content
    )

    transformed_content = plugin_manager.run_hook("on_note_save", note_path=note_path, content=final_content)
    if transformed_content is None:
        transformed_content = final_content

    success = save_note(config["storage"]["notes_dir"], note_path, transformed_content)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to create note from template")

    return {
        "success": True,
        "path": note_path,
        "message": "Note created from template successfully",
        "content": final_content,
    }
