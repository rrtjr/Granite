"""
Granite - Settings Service
Handles user settings and configuration management.
"""

import json
from pathlib import Path

import yaml  # type: ignore[import-untyped]


def get_default_user_settings() -> dict:
    """
    Get default user settings structure.

    Returns:
        Dictionary with default user settings
    """
    return {
        "reading": {
            "width": "full",  # 'narrow', 'medium', 'wide', 'full'
            "align": "left",  # 'left', 'center', 'justified'
            "margins": "normal",  # 'compact', 'normal', 'relaxed', 'extra-relaxed'
            "bannerOpacity": 0.5,  # 0.0 to 1.0 - opacity of banner gradient overlay
        },
        "performance": {
            "updateDelay": 100,
            "statsDelay": 300,
            "metadataDelay": 300,
            "historyDelay": 500,
            "autosaveDelay": 1000,
        },
        "paths": {"templatesDir": "_templates"},
        "datetime": {
            "timezone": "local",  # "local", "UTC", or IANA timezone like "America/New_York"
            "updateModifiedOnOpen": True,  # Update modified date when file is opened
        },
        "plugins": {},  # Plugin-specific settings
    }


def load_user_settings(settings_path: Path) -> dict:
    """
    Load user settings from user-settings.json.
    Creates file with defaults if it doesn't exist.

    Args:
        settings_path: Path to user-settings.json file

    Returns:
        Dictionary with user settings
    """
    try:
        if settings_path.exists():
            with settings_path.open("r", encoding="utf-8") as f:
                settings = json.load(f)
                # Merge with defaults to ensure all keys exist
                defaults = get_default_user_settings()
                for section in defaults:
                    if section not in settings:
                        settings[section] = defaults[section]
                    else:
                        # Merge section-level defaults
                        for key in defaults[section]:
                            if key not in settings[section]:
                                settings[section][key] = defaults[section][key]
                return dict(settings)
        else:
            # Create default settings file
            defaults = get_default_user_settings()
            save_user_settings(settings_path, defaults)
            return defaults
    except Exception as e:
        print(f"Error loading user settings: {e}")
        return get_default_user_settings()


def save_user_settings(settings_path: Path, settings: dict) -> bool:
    """
    Save user settings to user-settings.json.

    Args:
        settings_path: Path to user-settings.json file
        settings: Settings dictionary to save

    Returns:
        True if successful, False otherwise
    """
    try:
        # Ensure parent directory exists
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with settings_path.open("w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving user settings: {e}")
        return False


def update_user_setting(settings_path: Path, section: str, key: str, value) -> tuple[bool, dict]:
    """
    Update a specific user setting.

    Args:
        settings_path: Path to user-settings.json file
        section: Setting section ('reading', 'performance', 'paths')
        key: Setting key within section
        value: New value

    Returns:
        Tuple of (success, updated_settings)
    """
    try:
        settings = load_user_settings(settings_path)

        if section not in settings:
            settings[section] = {}

        settings[section][key] = value

        success = save_user_settings(settings_path, settings)
        return success, settings
    except Exception as e:
        print(f"Error updating user setting: {e}")
        return False, get_default_user_settings()


def update_config_value(config_path: Path, key_path: str, value: str) -> bool:
    """
    Update a configuration value in config.yaml.

    Args:
        config_path: Path to config.yaml file
        key_path: Dot-separated path to the config key (e.g., "storage.templates_dir")
        value: New value to set

    Returns:
        True if successful, False otherwise
    """
    try:
        # Read current config
        with config_path.open("r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        # Navigate to the correct nested location and update
        keys = key_path.split(".")
        current = config
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]

        # Set the value
        current[keys[-1]] = value

        # Write back to file
        with config_path.open("w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)

        return True
    except Exception as e:
        print(f"Error updating config: {e}")
        return False
