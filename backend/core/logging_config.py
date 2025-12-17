"""
Logging configuration for Granite using Loguru
Replaces print() statements with structured, beautiful logging
"""

import sys
from pathlib import Path

from loguru import logger


def setup_logging(
    log_level: str = "INFO", log_file: str | None = None, json_format: bool = False, colorize: bool = True
) -> None:
    """
    Configure structured logging for the application using Loguru

    Args:
        log_level: Logging level (TRACE, DEBUG, INFO, SUCCESS, WARNING, ERROR, CRITICAL)
        log_file: Optional path to log file
        json_format: Use JSON format for logs (useful for log aggregation)
        colorize: Use colors in console output

    Example:
        setup_logging(log_level="DEBUG", log_file="logs/granite.log", json_format=True)
    """

    # Remove default handler
    logger.remove()

    # Console handler with colors
    if json_format:
        console_format = (
            "{{"
            '"timestamp":"{time:YYYY-MM-DD HH:mm:ss.SSS}",'
            '"level":"{level}",'
            '"logger":"{name}",'
            '"function":"{function}",'
            '"line":{line},'
            '"message":"{message}"'
            "}}"
        )
    else:
        console_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )

    logger.add(
        sys.stdout,
        format=console_format,
        level=log_level.upper(),
        colorize=colorize,
        enqueue=True,  # Thread-safe logging
    )

    # File handler (optional)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # JSON format for file logging (easier to parse)
        file_format = (
            "{{"
            '"timestamp":"{time:YYYY-MM-DD HH:mm:ss.SSS}",'
            '"level":"{level}",'
            '"logger":"{name}",'
            '"function":"{function}",'
            '"line":{line},'
            '"message":"{message}",'
            '"extra":{extra}'
            "}}"
        )

        logger.add(
            log_file,
            format=file_format,
            level="DEBUG",  # Log everything to file
            rotation="10 MB",  # Rotate when file reaches 10MB
            retention="7 days",  # Keep logs for 7 days
            compression="zip",  # Compress rotated logs
            enqueue=True,
            serialize=json_format,  # Use JSON serialization if requested
        )

    # Add context for request tracking
    logger.configure(
        extra={"request_id": None}  # Will be set by middleware
    )

    logger.info(f"Logging configured: level={log_level}, file={log_file}, json={json_format}")


def get_logger(name: str | None = None):
    """
    Get a logger instance

    Note: With loguru, you can just use `from loguru import logger` directly.
    This function is provided for compatibility and optional name binding.

    Args:
        name: Optional logger name (for organization)

    Returns:
        Logger instance

    Example:
        from backend.core.logging_config import get_logger

        logger = get_logger(__name__)
        logger.info("Hello from my module")
    """
    if name:
        return logger.bind(logger_name=name)
    return logger


# Convenience function to disable loguru in specific modules
def silence_logger(module_name: str):
    """
    Disable logging for a specific module

    Args:
        module_name: Name of the module to silence (e.g., "uvicorn.access")

    Example:
        silence_logger("uvicorn.access")
    """
    logger.disable(module_name)


# Configure uvicorn to use loguru
def configure_uvicorn_logging():
    """
    Configure uvicorn to use loguru instead of standard logging

    Call this before starting uvicorn.
    """
    import logging

    class InterceptHandler(logging.Handler):
        """
        Handler that intercepts standard logging and redirects to loguru
        """

        def emit(self, record):
            # Get corresponding Loguru level if it exists
            try:
                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno

            # Find caller from where originated the logged message
            frame, depth = logging.currentframe(), 2
            while frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1

            logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

    # Intercept uvicorn and fastapi loggers
    logging.getLogger("uvicorn").handlers = [InterceptHandler()]
    logging.getLogger("uvicorn.access").handlers = [InterceptHandler()]
    logging.getLogger("fastapi").handlers = [InterceptHandler()]

    # Reduce verbosity
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
