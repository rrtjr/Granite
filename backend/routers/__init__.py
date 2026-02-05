"""
Granite - API Routers
"""

from .api_config import router as api_config_router
from .auth import router as auth_router
from .drawio import router as drawio_router
from .folders import router as folders_router
from .formatter import router as formatter_router
from .images import router as images_router
from .notes import router as notes_router
from .pages import router as pages_router
from .plugins import router as plugins_router
from .plugins_git import router as plugins_git_router
from .plugins_pdf import router as plugins_pdf_router
from .tags import router as tags_router
from .templates import router as templates_router
from .themes import router as themes_router

__all__ = [
    "api_config_router",
    "auth_router",
    "drawio_router",
    "folders_router",
    "formatter_router",
    "images_router",
    "notes_router",
    "pages_router",
    "plugins_git_router",
    "plugins_pdf_router",
    "plugins_router",
    "tags_router",
    "templates_router",
    "themes_router",
]
