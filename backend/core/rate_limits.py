"""
Granite - Centralized Rate Limits
Defines rate limit configurations for different operation types.
"""

# Rate limit categories for different operation types
# These are applied via @limiter.limit(RATE_LIMITS["category"])
RATE_LIMITS = {
    # Read operations - higher limits for data retrieval
    "read": "120/minute",
    "read_frequent": "200/minute",  # For very frequent reads like config
    # Write operations - moderate limits for create/update
    "write": "60/minute",
    "write_moderate": "30/minute",  # For less frequent writes
    # Delete operations - lower limits for destructive actions
    "delete": "30/minute",
    # Sensitive operations - strict limits for security-related actions
    "sensitive": "10/minute",
    # File uploads - limited due to resource intensity
    "upload": "20/minute",
    # Plugin operations - limited due to potential side effects
    "plugin": "10/minute",
    "plugin_action": "5/minute",  # For manual actions like git backup
}
