"""
Granite - Theme Routes
Handles theme listing and CSS retrieval.
"""

from pathlib import Path

from fastapi import APIRouter, Depends

from backend.dependencies import require_auth
from backend.themes import get_available_themes

router = APIRouter(
    prefix="/api/themes",
    dependencies=[Depends(require_auth)],
    tags=["themes"],
)

# Themes directory path
themes_dir = Path(__file__).parent.parent.parent / "themes"


@router.get("")
async def list_themes():
    """Get all available themes"""
    themes = get_available_themes(str(themes_dir))
    return {"themes": themes}


# Note: This endpoint is defined separately in main.py without auth
# to allow theme loading before authentication
