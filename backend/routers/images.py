"""
Granite - Image Routes
Handles image serving and uploading.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from backend.config import config
from backend.dependencies import limiter, require_auth, safe_error_message
from backend.utils import save_uploaded_image, validate_path_security

router = APIRouter(
    prefix="/api",
    dependencies=[Depends(require_auth)],
    tags=["images"],
)


@router.get("/images/{image_path:path}")
async def get_image(image_path: str):
    """
    Serve an image file with authentication protection.
    """
    try:
        notes_dir = config["storage"]["notes_dir"]
        full_path = Path(notes_dir) / image_path

        # Security: Validate path is within notes directory
        if not validate_path_security(notes_dir, full_path):
            raise HTTPException(status_code=403, detail="Access denied")

        # Check file exists and is an image
        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="Image not found")

        # Validate it's an image file
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        if full_path.suffix.lower() not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Not an image file")

        # Return the file
        return FileResponse(full_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to load image")) from e


@router.post("/upload-image")
@limiter.limit("20/minute")
async def upload_image(request: Request, file: UploadFile = File(...), note_path: str = Form(...)):
    """
    Upload an image file and save it to the attachments directory.
    Returns the relative path to the image for markdown linking.
    """
    try:
        # Validate file type
        allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

        # Get file extension
        file_ext = Path(file.filename).suffix.lower() if file.filename else ""

        if file.content_type not in allowed_types and file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: jpg, jpeg, png, gif, webp. Got: {file.content_type}",
            )

        # Read file data
        file_data = await file.read()

        # Validate file size (10MB max)
        max_size = 10 * 1024 * 1024  # 10MB in bytes
        if len(file_data) > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: 10MB. Uploaded: {len(file_data) / 1024 / 1024:.2f}MB",
            )

        # Save the image
        image_path = save_uploaded_image(config["storage"]["notes_dir"], note_path, file.filename, file_data)

        if not image_path:
            raise HTTPException(status_code=500, detail="Failed to save image")

        return {
            "success": True,
            "path": image_path,
            "filename": Path(image_path).name,
            "message": "Image uploaded successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_message(e, "Failed to upload image")) from e
