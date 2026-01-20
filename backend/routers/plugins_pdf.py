"""
Granite - PDF Export Plugin Routes
Handles PDF export plugin settings and export operations.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from backend.config import user_settings_path
from backend.core.decorators import handle_errors
from backend.core.rate_limits import RATE_LIMITS
from backend.dependencies import limiter, plugin_manager, require_auth
from backend.services import update_user_setting

router = APIRouter(
    prefix="/api/plugins/pdf_export",
    dependencies=[Depends(require_auth)],
    tags=["plugins-pdf"],
)


@router.get("/settings")
@handle_errors("Failed to get PDF export settings")
async def get_pdf_export_settings():
    """Get PDF export plugin settings"""
    plugin = plugin_manager.plugins.get("pdf_export")
    if not plugin:
        raise HTTPException(status_code=404, detail="PDF Export plugin not found")

    if hasattr(plugin, "get_settings"):
        return {"settings": plugin.get_settings()}
    raise HTTPException(status_code=400, detail="Plugin does not support settings")


@router.post("/settings")
@limiter.limit(RATE_LIMITS["plugin"])
@handle_errors("Failed to update PDF export settings")
async def update_pdf_export_settings(request: Request, settings: dict):
    """Update PDF export plugin settings and persist to user-settings.json"""
    plugin = plugin_manager.plugins.get("pdf_export")
    if not plugin:
        raise HTTPException(status_code=404, detail="PDF Export plugin not found")

    if hasattr(plugin, "update_settings"):
        plugin.update_settings(settings)

        # Persist to user-settings.json
        success, _ = update_user_setting(user_settings_path, "plugins", "pdf_export", plugin.get_settings())  # type: ignore[attr-defined]

        if not success:
            print("Warning: Failed to persist PDF export plugin settings to user-settings.json")

        return {
            "success": True,
            "message": "PDF export settings updated",
            "settings": plugin.get_settings() if hasattr(plugin, "get_settings") else {},  # type: ignore[attr-defined]
        }
    raise HTTPException(status_code=400, detail="Plugin does not support settings updates")


@router.post("/export")
@limiter.limit(RATE_LIMITS["upload"])
@handle_errors("Failed to export PDF")
async def export_note_to_pdf(request: Request, data: dict):
    """Export a note to PDF"""
    plugin = plugin_manager.plugins.get("pdf_export")
    if not plugin:
        raise HTTPException(status_code=404, detail="PDF Export plugin not found")

    if not plugin.enabled:
        raise HTTPException(status_code=400, detail="PDF Export plugin is not enabled")

    note_path = data.get("note_path")
    content = data.get("content")
    output_filename = data.get("output_filename")

    if not note_path:
        raise HTTPException(status_code=400, detail="note_path is required")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    if not hasattr(plugin, "export_note"):
        raise HTTPException(status_code=400, detail="Plugin does not support PDF export")

    success, message, pdf_path = plugin.export_note(  # type: ignore[attr-defined]
        note_path=note_path, content=content, output_filename=output_filename
    )

    if success and pdf_path:
        # Return the PDF file
        return FileResponse(pdf_path, media_type="application/pdf", filename=Path(pdf_path).name)
    raise HTTPException(status_code=500, detail=message)


@router.get("/options")
@handle_errors("Failed to get PDF export options")
async def get_pdf_export_options():
    """Get available PDF export options"""
    plugin = plugin_manager.plugins.get("pdf_export")
    if not plugin:
        raise HTTPException(status_code=404, detail="PDF Export plugin not found")

    return {
        "page_sizes": plugin.get_supported_page_sizes() if hasattr(plugin, "get_supported_page_sizes") else [],
        "orientations": plugin.get_supported_orientations() if hasattr(plugin, "get_supported_orientations") else [],
        "fonts": plugin.get_supported_fonts() if hasattr(plugin, "get_supported_fonts") else [],
    }
