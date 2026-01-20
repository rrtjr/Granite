"""
Granite - Note Routes
Handles note CRUD operations, search, and graph visualization.
"""

import re
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.config import config, user_settings_path
from backend.core.decorators import handle_errors
from backend.core.rate_limits import RATE_LIMITS
from backend.dependencies import limiter, plugin_manager, require_auth
from backend.services import (
    create_note_metadata,
    delete_note,
    get_all_folders,
    get_all_notes,
    get_note_content,
    load_user_settings,
    move_note,
    save_note,
    search_notes,
)
from backend.utils import format_datetime_for_frontmatter, update_frontmatter_field

router = APIRouter(
    prefix="/api/notes",
    dependencies=[Depends(require_auth)],
    tags=["notes"],
)


@router.get("")
@handle_errors("Failed to list notes")
async def list_notes():
    """List all notes with metadata"""
    notes = get_all_notes(config["storage"]["notes_dir"])
    folders = get_all_folders(config["storage"]["notes_dir"])
    return {"notes": notes, "folders": folders}


@router.post("/move")
@limiter.limit(RATE_LIMITS["write_moderate"])
@handle_errors("Failed to move note")
async def move_note_endpoint(request: Request, data: dict):
    """Move a note to a different folder"""
    old_path = data.get("oldPath", "")
    new_path = data.get("newPath", "")

    if not old_path or not new_path:
        raise HTTPException(status_code=400, detail="Both oldPath and newPath required")

    success = move_note(config["storage"]["notes_dir"], old_path, new_path)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to move note")

    # Run plugin hooks
    plugin_manager.run_hook("on_note_save", note_path=new_path, content="")

    return {"success": True, "oldPath": old_path, "newPath": new_path, "message": "Note moved successfully"}


@router.get("/{note_path:path}")
@handle_errors("Failed to load note")
async def get_note(note_path: str):
    """Get a specific note's content"""
    content = get_note_content(config["storage"]["notes_dir"], note_path)
    if content is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # Load user settings for datetime configuration
    user_settings = load_user_settings(user_settings_path)
    datetime_settings = user_settings.get("datetime", {})

    # Update modified date if enabled and frontmatter exists
    if datetime_settings.get("updateModifiedOnOpen", True):
        tz_setting = datetime_settings.get("timezone", "local")
        new_modified = format_datetime_for_frontmatter(tz_setting=tz_setting)
        updated_content = update_frontmatter_field(content, "modified", new_modified)

        if updated_content != content:
            save_note(config["storage"]["notes_dir"], note_path, updated_content)
            content = updated_content

    # Run on_note_load hook (can transform content, e.g., decrypt)
    transformed_content = plugin_manager.run_hook("on_note_load", note_path=note_path, content=content)
    if transformed_content is not None:
        content = transformed_content

    return {
        "path": note_path,
        "content": content,
        "metadata": create_note_metadata(config["storage"]["notes_dir"], note_path),
    }


@router.post("/{note_path:path}")
@limiter.limit(RATE_LIMITS["write"])
@handle_errors("Failed to save note")
async def create_or_update_note(request: Request, note_path: str, content: dict):
    """Create or update a note"""
    note_content = content.get("content", "")

    # Check if this is a new note (doesn't exist yet)
    existing_content = get_note_content(config["storage"]["notes_dir"], note_path)
    is_new_note = existing_content is None

    # If creating a new note, run on_note_create hook to allow plugins to modify initial content
    if is_new_note:
        note_content = plugin_manager.run_hook_with_return(
            "on_note_create", note_path=note_path, initial_content=note_content
        )

    # Run on_note_save hook (can transform content, e.g., encrypt)
    transformed_content = plugin_manager.run_hook("on_note_save", note_path=note_path, content=note_content)
    if transformed_content is None:
        transformed_content = note_content

    success = save_note(config["storage"]["notes_dir"], note_path, transformed_content)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save note")

    return {
        "success": True,
        "path": note_path,
        "message": "Note created successfully" if is_new_note else "Note saved successfully",
        "content": note_content,  # Return the (potentially modified) content
    }


@router.delete("/{note_path:path}")
@limiter.limit(RATE_LIMITS["delete"])
@handle_errors("Failed to delete note")
async def remove_note(request: Request, note_path: str):
    """Delete a note"""
    success = delete_note(config["storage"]["notes_dir"], note_path)

    if not success:
        raise HTTPException(status_code=404, detail="Note not found")

    # Run plugin hooks
    plugin_manager.run_hook("on_note_delete", note_path=note_path)

    return {"success": True, "message": "Note deleted successfully"}


# Search router - separate prefix
search_router = APIRouter(
    prefix="/api",
    dependencies=[Depends(require_auth)],
    tags=["search"],
)


@search_router.get("/search")
@handle_errors("Search failed")
async def search(q: str):
    """Search notes by content"""
    if not config["search"]["enabled"]:
        raise HTTPException(status_code=403, detail="Search is disabled")

    results = search_notes(config["storage"]["notes_dir"], q)

    # Run plugin hooks
    plugin_manager.run_hook("on_search", query=q, results=results)

    return {"results": results, "query": q}


# Graph router - separate prefix
graph_router = APIRouter(
    prefix="/api",
    dependencies=[Depends(require_auth)],
    tags=["graph"],
)


@graph_router.get("/graph")
@handle_errors("Failed to generate graph data")
async def get_graph():
    """Get graph data for note visualization with wikilink and markdown link detection"""
    notes = get_all_notes(config["storage"]["notes_dir"])
    nodes = []
    edges = []

    # Build set of valid note names/paths for matching
    note_paths = set()
    note_paths_lower = {}  # Map lowercase path -> actual path for case-insensitive matching
    note_names = {}  # Map name -> path for quick lookup

    for note in notes:
        if note.get("type") == "note":
            note_paths.add(note["path"])
            note_paths.add(note["path"].replace(".md", ""))
            # Store lowercase path -> actual path mapping for case-insensitive matching
            note_paths_lower[note["path"].lower()] = note["path"]
            note_paths_lower[note["path"].replace(".md", "").lower()] = note["path"]
            # Store name -> path mapping (without extension)
            name = note["name"].replace(".md", "")
            note_names[name.lower()] = note["path"]
            note_names[note["name"].lower()] = note["path"]

    # Build graph structure with link detection
    for note in notes:
        if note.get("type") == "note":
            nodes.append({"id": note["path"], "label": note["name"].replace(".md", "")})

            # Read note content to find links
            content = get_note_content(config["storage"]["notes_dir"], note["path"])
            if content:
                # Find wikilinks: [[target]] or [[target|display]]
                wikilinks = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", content)

                # Find standard markdown internal links: [text](path) - any local path (not http/https)
                # Match links that don't start with http://, https://, mailto:, #, etc.
                markdown_links = re.findall(r"\[([^\]]+)\]\((?!https?://|mailto:|#|data:)([^\)]+)\)", content)

                # Process wikilinks
                for target_raw in wikilinks:
                    target = target_raw.strip()
                    target_lower = target.lower()

                    # Try to match target to an existing note
                    target_path = None

                    # 1. Exact path match
                    if target in note_paths:
                        target_path = target if target.endswith(".md") else target + ".md"
                    # 2. Path with .md extension
                    elif target + ".md" in note_paths:
                        target_path = target + ".md"
                    # 3. Case-insensitive path match (e.g., [[Folder/Note]] -> folder/note.md)
                    elif target_lower in note_paths_lower:
                        target_path = note_paths_lower[target_lower]
                    elif target_lower + ".md" in note_paths_lower:
                        target_path = note_paths_lower[target_lower + ".md"]
                    # 4. Just note name (case-insensitive)
                    elif target_lower in note_names:
                        target_path = note_names[target_lower]

                    if target_path and target_path != note["path"]:
                        edges.append({"source": note["path"], "target": target_path, "type": "wikilink"})

                # Process markdown links
                for _, link_path_raw in markdown_links:
                    # Skip anchor-only links and external protocols
                    if not link_path_raw or link_path_raw.startswith("#"):
                        continue

                    # Remove anchor part if present (e.g., "note.md#section" -> "note.md")
                    link_path = link_path_raw.split("#")[0]
                    if not link_path:
                        continue

                    # Normalize path: remove ./ prefix, handle URL encoding
                    link_path = urllib.parse.unquote(link_path)
                    if link_path.startswith("./"):
                        link_path = link_path[2:]

                    # Add .md extension if not present and doesn't have other extension
                    link_path_with_md = link_path if link_path.endswith(".md") else link_path + ".md"
                    link_path_lower = link_path.lower()
                    link_path_with_md_lower = link_path_with_md.lower()

                    # Try to match target to an existing note
                    target_path = None

                    # 1. Exact path match (with or without .md)
                    if link_path in note_paths:
                        target_path = link_path if link_path.endswith(".md") else link_path + ".md"
                    elif link_path_with_md in note_paths:
                        target_path = link_path_with_md
                    # 2. Case-insensitive path match
                    elif link_path_lower in note_paths_lower:
                        target_path = note_paths_lower[link_path_lower]
                    elif link_path_with_md_lower in note_paths_lower:
                        target_path = note_paths_lower[link_path_with_md_lower]
                    # 3. Try matching by filename only (for relative links)
                    else:
                        # Extract just the filename
                        filename = link_path.split("/")[-1]
                        filename_lower = filename.lower()
                        filename_with_md = filename if filename.endswith(".md") else filename + ".md"
                        filename_with_md_lower = filename_with_md.lower()

                        if filename_lower in note_names:
                            target_path = note_names[filename_lower]
                        elif filename_with_md_lower in note_names:
                            target_path = note_names[filename_with_md_lower]

                    if target_path and target_path != note["path"]:
                        edges.append({"source": note["path"], "target": target_path, "type": "markdown"})

    # Remove duplicate edges
    seen = set()
    unique_edges = []
    for edge in edges:
        key = (edge["source"], edge["target"])
        if key not in seen:
            seen.add(key)
            unique_edges.append(edge)

    return {"nodes": nodes, "edges": unique_edges}
