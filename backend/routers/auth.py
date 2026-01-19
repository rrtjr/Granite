"""
Granite - Authentication Routes
Handles login, logout, and session management.
"""

import aiofiles  # type: ignore[import-untyped]
from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from backend.config import static_path
from backend.dependencies import auth_enabled, verify_password

router = APIRouter(tags=["auth"])


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str | None = None):
    """Serve the login page"""
    if not auth_enabled():
        return RedirectResponse(url="/", status_code=303)

    # If already authenticated, redirect to home
    if request.session.get("authenticated"):
        return RedirectResponse(url="/", status_code=303)

    # Serve login page
    login_path = static_path / "login.html"
    async with aiofiles.open(login_path, encoding="utf-8") as f:
        content = await f.read()

    # Inject error message if present
    if error:
        content = content.replace("<!-- ERROR_CLASS_PLACEHOLDER -->", 'class="error"')
        content = content.replace("<!-- ERROR_MESSAGE_PLACEHOLDER -->", f'<div class="error-message">{error}</div>')
    else:
        content = content.replace("<!-- ERROR_CLASS_PLACEHOLDER -->", "")
        content = content.replace("<!-- ERROR_MESSAGE_PLACEHOLDER -->", "")

    return content


@router.post("/login")
async def login(request: Request, password: str = Form(...)):
    """Handle login form submission"""
    if not auth_enabled():
        return RedirectResponse(url="/", status_code=303)

    # Verify password
    if verify_password(password):
        # Session regeneration: Clear old session to prevent session fixation attacks
        # This forces the creation of a new session ID after successful authentication
        request.session.clear()

        # Set authenticated flag in the NEW session
        request.session["authenticated"] = True
        return RedirectResponse(url="/", status_code=303)
    # Redirect back to login with error message
    return RedirectResponse(url="/login?error=Incorrect+password.+Please+try+again.", status_code=303)


@router.get("/logout")
async def logout(request: Request):
    """Log out the current user"""
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)
