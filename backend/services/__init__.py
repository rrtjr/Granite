"""
Granite - Service Layer
Provides business logic services organized by domain.
"""

from .folder_service import (
    create_folder,
    delete_folder,
    get_all_folders,
    move_folder,
    rename_folder,
)
from .image_service import (
    get_all_images,
    get_attachment_dir,
    sanitize_filename,
    save_uploaded_image,
)
from .note_service import (
    create_note_metadata,
    delete_note,
    get_all_notes,
    get_note_content,
    move_note,
    save_note,
)
from .search_service import search_notes
from .settings_service import (
    get_default_user_settings,
    load_user_settings,
    save_user_settings,
    update_config_value,
    update_user_setting,
)
from .tag_service import (
    clear_tag_cache,
    get_all_tags,
    get_notes_by_tag,
    get_tags_cached,
    parse_tags,
)
from .template_service import (
    apply_template_placeholders,
    get_template_content,
    get_templates,
)

__all__ = [
    "apply_template_placeholders",
    "clear_tag_cache",
    "create_folder",
    "create_note_metadata",
    "delete_folder",
    "delete_note",
    "get_all_folders",
    "get_all_images",
    "get_all_notes",
    "get_all_tags",
    "get_attachment_dir",
    "get_default_user_settings",
    "get_note_content",
    "get_notes_by_tag",
    "get_tags_cached",
    "get_template_content",
    "get_templates",
    "load_user_settings",
    "move_folder",
    "move_note",
    "parse_tags",
    "rename_folder",
    "sanitize_filename",
    "save_note",
    "save_uploaded_image",
    "save_user_settings",
    "search_notes",
    "update_config_value",
    "update_user_setting",
]
