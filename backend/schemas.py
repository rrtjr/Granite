"""
Granite - Pydantic Response Models
Type-safe API response schemas for documentation and validation.
"""

from pydantic import BaseModel, Field

# ============================================================================
# Common Response Models
# ============================================================================


class SuccessResponse(BaseModel):
    """Standard success response"""

    success: bool
    message: str | None = None


class ErrorResponse(BaseModel):
    """Standard error response"""

    detail: str


# ============================================================================
# Note Models
# ============================================================================


class NoteMetadata(BaseModel):
    """Metadata for a note"""

    name: str
    path: str
    folder: str
    modified: str
    size: int
    type: str = "note"
    tags: list[str] = Field(default_factory=list)


class NoteListResponse(BaseModel):
    """Response for listing notes"""

    notes: list[NoteMetadata]
    folders: list[str]


class NoteContentResponse(BaseModel):
    """Response for getting note content"""

    path: str
    content: str
    metadata: dict


class NoteSaveResponse(SuccessResponse):
    """Response for saving a note"""

    path: str
    content: str


class NoteMoveResponse(SuccessResponse):
    """Response for moving a note"""

    old_path: str = Field(serialization_alias="oldPath")
    new_path: str = Field(serialization_alias="newPath")


class NoteDeleteResponse(SuccessResponse):
    """Response for deleting a note"""

    path: str


# ============================================================================
# Folder Models
# ============================================================================


class FolderCreateResponse(SuccessResponse):
    """Response for creating a folder"""

    path: str


class FolderMoveResponse(SuccessResponse):
    """Response for moving/renaming a folder"""

    old_path: str = Field(serialization_alias="oldPath")
    new_path: str = Field(serialization_alias="newPath")


class FolderDeleteResponse(SuccessResponse):
    """Response for deleting a folder"""

    path: str


# ============================================================================
# Search Models
# ============================================================================


class SearchMatch(BaseModel):
    """A single search match within a file"""

    line_number: int
    context: str


class SearchResult(BaseModel):
    """Search result for a single file"""

    name: str
    path: str
    folder: str
    matches: list[SearchMatch]


class SearchResponse(BaseModel):
    """Response for search queries"""

    results: list[SearchResult]
    query: str


# ============================================================================
# Graph Models
# ============================================================================


class GraphNode(BaseModel):
    """Node in the knowledge graph"""

    id: str
    label: str


class GraphEdge(BaseModel):
    """Edge in the knowledge graph"""

    source: str
    target: str
    type: str


class GraphResponse(BaseModel):
    """Response for graph data"""

    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ============================================================================
# Tag Models
# ============================================================================


class TagListResponse(BaseModel):
    """Response for listing all tags"""

    tags: dict[str, int]


class TagNotesResponse(BaseModel):
    """Response for notes with a specific tag"""

    tag: str
    count: int
    notes: list[NoteMetadata]


# ============================================================================
# Template Models
# ============================================================================


class TemplateMetadata(BaseModel):
    """Metadata for a template"""

    name: str
    path: str
    modified: str


class TemplateListResponse(BaseModel):
    """Response for listing templates"""

    templates: list[TemplateMetadata]


class TemplateContentResponse(BaseModel):
    """Response for getting template content"""

    name: str
    content: str


class TemplateCreateNoteResponse(SuccessResponse):
    """Response for creating a note from template"""

    path: str
    content: str


# ============================================================================
# Image Models
# ============================================================================


class ImageMetadata(BaseModel):
    """Metadata for an image"""

    name: str
    path: str
    folder: str
    modified: str
    size: int
    type: str = "image"


class ImageUploadResponse(SuccessResponse):
    """Response for image upload"""

    path: str
    url: str


class ImageListResponse(BaseModel):
    """Response for listing images"""

    images: list[ImageMetadata]


class ImageDeleteResponse(SuccessResponse):
    """Response for deleting an image"""

    path: str


# ============================================================================
# Config Models
# ============================================================================


class AuthConfig(BaseModel):
    """Authentication configuration"""

    enabled: bool


class AppConfigResponse(BaseModel):
    """Response for app configuration"""

    name: str
    tagline: str
    version: str
    search_enabled: bool = Field(serialization_alias="searchEnabled")
    demo_mode: bool = Field(serialization_alias="demoMode")
    authentication: AuthConfig


class TemplatesDirResponse(BaseModel):
    """Response for templates directory"""

    templates_dir: str = Field(serialization_alias="templatesDir")


class UserSettingsResponse(SuccessResponse):
    """Response for user settings update"""

    settings: dict


# ============================================================================
# Plugin Models
# ============================================================================


class PluginInfo(BaseModel):
    """Information about a plugin"""

    name: str
    description: str
    version: str
    enabled: bool
    has_settings: bool = Field(alias="hasSettings")

    class Config:
        populate_by_name = True


class PluginListResponse(BaseModel):
    """Response for listing plugins"""

    plugins: list[PluginInfo]


class PluginToggleResponse(SuccessResponse):
    """Response for toggling a plugin"""

    plugin: str
    enabled: bool


# ============================================================================
# Git Plugin Models
# ============================================================================


class GitSettingsResponse(BaseModel):
    """Response for git settings"""

    enabled: bool
    remote_url: str
    branch: str
    auto_backup: bool
    backup_interval: int


class GitStatusResponse(BaseModel):
    """Response for git status"""

    initialized: bool
    has_remote: bool
    branch: str | None
    uncommitted_changes: int
    last_commit: str | None
    last_commit_date: str | None


class GitBackupResponse(SuccessResponse):
    """Response for manual git backup"""

    committed: bool
    pushed: bool
    commit_message: str | None = None
