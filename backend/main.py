"""
Granite - Self-Hosted Markdown Knowledge Base
Main FastAPI application factory
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.sessions import SessionMiddleware

from .config import DEMO_MODE, allowed_origins, config, static_path
from .core.exceptions import http_exception_handler
from .dependencies import limiter
from .routers import (
    api_config_router,
    auth_router,
    drawio_router,
    folders_router,
    formatter_router,
    images_router,
    notes_router,
    pages_router,
    plugins_git_router,
    plugins_pdf_router,
    plugins_router,
    tags_router,
    templates_router,
    themes_router,
)
from .routers.notes import graph_router, search_router
from .themes import get_theme_css

app = FastAPI(
    title=config["app"]["name"],
    description=config["app"]["tagline"],
    version=config["app"]["version"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=config.get("authentication", {}).get("secret_key", "insecure_default_key_change_this"),
    max_age=config.get("authentication", {}).get("session_max_age", 604800),  # 7 days default
    same_site="lax",  # Prevents CSRF attacks
    https_only=config.get("server", {}).get("https_only", False),  # Set via config when behind HTTPS proxy
)

if DEMO_MODE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_exception_handler(HTTPException, http_exception_handler)

app.mount("/static", StaticFiles(directory=static_path), name="static")

if os.getenv("ENABLE_TESTS", "false").lower() == "true":
    tests_path = Path(__file__).parent.parent / "tests"
    if tests_path.exists():
        app.mount("/tests", StaticFiles(directory=tests_path), name="tests")
        print("WARNING: Tests are enabled and accessible at /tests/")
        print("   Set ENABLE_TESTS=false in production!")


@app.get("/api/themes/{theme_id}")
async def get_theme(theme_id: str):
    """Get CSS for a specific theme"""
    themes_dir = Path(__file__).parent.parent / "themes"
    css = get_theme_css(str(themes_dir), theme_id)

    if not css:
        raise HTTPException(status_code=404, detail="Theme not found")

    return {"css": css, "theme_id": theme_id}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "app": config["app"]["name"], "version": config["app"]["version"]}


app.include_router(auth_router)
app.include_router(api_config_router)
app.include_router(themes_router)
app.include_router(folders_router)
app.include_router(images_router)
app.include_router(tags_router)
app.include_router(templates_router)
app.include_router(notes_router)
app.include_router(search_router)
app.include_router(graph_router)
app.include_router(plugins_router)
app.include_router(plugins_git_router)
app.include_router(plugins_pdf_router)
app.include_router(formatter_router)
app.include_router(drawio_router)
app.include_router(pages_router)  # SPA catch-all - must be last


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=config["server"]["host"],
        port=config["server"]["port"],
        reload=config["server"]["reload"],
    )
