"""
Granite - Template Routes
Handles template listing, retrieval, and note creation from templates.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.config import config, user_settings_path
from backend.dependencies import get_templates_dir, limiter, plugin_manager, require_auth, safe_error_message
from backend.utils import (
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
@limiter.limit("120/minute")
async def list_templates(request: Request):
    """
    List all available templates from templates folder.

    Returns:
        List of template metadata
    """
    try:
        notes_dir = config["storage"]["notes_dir"]
        templates_dir = get_templates_dir()

        # Debug logging
        templates_path = Path(templates_dir) if Path(templates_dir).is_absolute() else Path(notes_dir) / templates_dir
        print(f"[DEBUG] Loading templates from: {templates_path.resolve()}")
        print(f"[DEBUG] Templates dir exists: {templates_path.exists()}")
        if templates_path.exists():
            md_files = list(templates_path.glob("*.md"))
            print(f"[DEBUG] Found {len(md_files)} .md files")

        templates = get_templates(notes_dir, templates_dir)
        print(f"[DEBUG] Returning {len(templates)} templates")

        return {"templates": templates}
    except Exception as e:
        print(f"[ERROR] Failed to list templates: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to list templates")) from e


@router.get("/{template_name}")
@limiter.limit("120/minute")
async def get_template(request: Request, template_name: str):
    """
    Get content of a specific template.

    Args:
        template_name: Name of the template (without .md extension)

    Returns:
        Template name and content
    """
    try:
        content = get_template_content(config["storage"]["notes_dir"], template_name, get_templates_dir())

        if content is None:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"name": template_name, "content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to get template")) from e


@router.post("/create-note")
@limiter.limit("60/minute")
async def create_note_from_template(request: Request, data: dict):
    """
    Create a new note from a template with placeholder replacement.

    Args:
        data: Dictionary containing templateName and notePath

    Returns:
        Success status, path, and created content
    """
    try:
        template_name = data.get("templateName", "")
        note_path = data.get("notePath", "")

        if not template_name or not note_path:
            raise HTTPException(status_code=400, detail="Template name and note path required")

        # Get template content
        template_content = get_template_content(config["storage"]["notes_dir"], template_name, get_templates_dir())

        if template_content is None:
            raise HTTPException(status_code=404, detail="Template not found")

        # Apply placeholder replacements with user timezone settings
        user_settings = load_user_settings(user_settings_path)
        final_content = apply_template_placeholders(template_content, note_path, user_settings)

        # Run on_note_create hook BEFORE saving (allows plugins to modify initial content)
        final_content = plugin_manager.run_hook_with_return(
            "on_note_create", note_path=note_path, initial_content=final_content
        )

        # Run on_note_save hook (can transform content, e.g., encrypt)
        transformed_content = plugin_manager.run_hook("on_note_save", note_path=note_path, content=final_content)
        if transformed_content is None:
            transformed_content = final_content

        # Save the note with the (potentially modified/transformed) content
        success = save_note(config["storage"]["notes_dir"], note_path, transformed_content)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create note from template")

        return {
            "success": True,
            "path": note_path,
            "message": "Note created from template successfully",
            "content": final_content,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to create note from template")) from e
