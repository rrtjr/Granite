"""
Granite - Folder Routes
Handles folder creation, moving, renaming, and deletion.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.config import config
from backend.dependencies import limiter, require_auth, safe_error_message
from backend.utils import (
    create_folder,
    delete_folder,
    move_folder,
    rename_folder,
)

router = APIRouter(
    prefix="/api/folders",
    dependencies=[Depends(require_auth)],
    tags=["folders"],
)


@router.post("")
@limiter.limit("30/minute")
async def create_new_folder(request: Request, data: dict):
    """Create a new folder"""
    try:
        folder_path = data.get("path", "")
        if not folder_path:
            raise HTTPException(status_code=400, detail="Folder path required")

        success = create_folder(config["storage"]["notes_dir"], folder_path)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create folder")

        return {"success": True, "path": folder_path, "message": "Folder created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to create folder")) from e


@router.post("/move")
@limiter.limit("20/minute")
async def move_folder_endpoint(request: Request, data: dict):
    """Move a folder to a different location"""
    try:
        old_path = data.get("oldPath", "")
        new_path = data.get("newPath", "")

        if not old_path or not new_path:
            raise HTTPException(status_code=400, detail="Both oldPath and newPath required")

        success = move_folder(config["storage"]["notes_dir"], old_path, new_path)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to move folder")

        return {"success": True, "oldPath": old_path, "newPath": new_path, "message": "Folder moved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to move folder")) from e


@router.post("/rename")
@limiter.limit("30/minute")
async def rename_folder_endpoint(request: Request, data: dict):
    """Rename a folder"""
    try:
        old_path = data.get("oldPath", "")
        new_path = data.get("newPath", "")

        if not old_path or not new_path:
            raise HTTPException(status_code=400, detail="Both oldPath and newPath required")

        success = rename_folder(config["storage"]["notes_dir"], old_path, new_path)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to rename folder")

        return {"success": True, "oldPath": old_path, "newPath": new_path, "message": "Folder renamed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to rename folder")) from e


@router.delete("/{folder_path:path}")
@limiter.limit("20/minute")
async def delete_folder_endpoint(request: Request, folder_path: str):
    """Delete a folder and all its contents"""
    try:
        if not folder_path:
            raise HTTPException(status_code=400, detail="Folder path required")

        success = delete_folder(config["storage"]["notes_dir"], folder_path)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete folder")

        return {"success": True, "path": folder_path, "message": "Folder deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to delete folder")) from e
