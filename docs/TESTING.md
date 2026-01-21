# Granite Testing Guide

Complete guide for running and understanding Granite's test suite.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Troubleshooting](#troubleshooting)

## Overview

Granite has a comprehensive test suite with **100+ test cases** covering:

- Backend API endpoints
- Plugin functionality (Git, PDF Export, Note Stats)
- Settings persistence
- User preferences
- Favorites feature
- Template system
- File operations
- Frontend UI tests (browser-based)

All tests use **pytest** and can run both locally and inside Docker containers.

## Quick Start

### Run All Tests (Docker - Recommended)

```bash
docker exec granite .venv/bin/pytest -v
```

### Run Specific Test Suite

```bash
# Plugin settings persistence
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py -v

# Git plugin tests
docker exec granite .venv/bin/pytest tests/test_git_plugin.py -v

# User settings tests
docker exec granite .venv/bin/pytest tests/test_user_settings.py -v
```

### With Coverage Report

```bash
docker exec granite .venv/bin/pytest --cov=backend --cov=plugins --cov-report=html -v
```

## Test Structure

```
tests/
├── test_favorites.py                        # Favorites feature tests
├── test_git_plugin.py                       # Git plugin functionality
├── test_pdf_export_plugin.py                # PDF export plugin
├── test_plugin_api.py                       # Plugin API endpoints
├── test_plugin_settings_persistence.py      # Plugin settings (70+ tests)
├── test_templates.py                        # Template system
├── test_user_settings.py                    # User settings API
├── test_favorites_ui.html                   # Frontend favorites tests (browser)
├── test_git_plugin_ui.html                  # Frontend git plugin tests
├── test_plugin_ui.html                      # Frontend plugin tests
└── test_unsplash_banner.html                # Frontend banner picker tests
```

## Running Tests

### Inside Docker (Recommended)

Docker ensures all system dependencies are available (libpango, etc.).

**Note**: pytest is installed in `.venv` inside the container, so use `.venv/bin/pytest`.

```bash
# All tests
docker exec granite .venv/bin/pytest -v

# Specific file
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py -v

# Specific class
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestGitPluginSettings -v

# Specific test
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestGitPluginSettings::test_git_plugin_available -v

# With coverage
docker exec granite .venv/bin/pytest --cov=backend --cov=plugins -v

# Interactive mode (activate venv inside container)
docker exec -it granite sh
source .venv/bin/activate
pytest tests/ -v
exit
```

### Locally (Virtual Environment)

Faster but may skip tests requiring system dependencies.

```bash
# Activate virtual environment
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Run tests
pytest -v

# With coverage
pytest --cov=backend --cov=plugins -v
```

## Test Coverage

### Plugin Settings Persistence (`test_plugin_settings_persistence.py`)

**70+ comprehensive tests** for all plugin settings.

#### Test Classes

**1. TestPluginSettingsGeneral**
- Generic tests for ANY plugin
- Validates plugins are loaded
- Tests settings endpoints
- Verifies persistence to user-settings.json

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestPluginSettingsGeneral -v
```

**2. TestGitPluginSettings**
- Git plugin specific tests
- Validates all git settings fields
- Critical test: `test_git_ignore_patterns_includes_user_settings`
  - Ensures user-settings.json is ignored to prevent circular commits

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestGitPluginSettings -v
```

**3. TestPDFExportPluginSettings**
- PDF export plugin tests
- Page size, orientation, font settings
- Requires libpango (Docker only)

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestPDFExportPluginSettings -v
```

**4. TestFileSystemPersistence**
- Core file write mechanism
- Validates modification times
- Tests multiple plugins coexist

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestFileSystemPersistence -v
```

**Key Tests**:
- `test_settings_write_to_disk` - Immediate disk writes
- `test_file_modification_time_updates` - File mtime changes
- `test_multiple_plugins_in_same_file` - Plugin isolation

**5. TestEdgeCases**
- Null values, empty strings
- Special characters
- Large settings objects
- Invalid plugins

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestEdgeCases -v
```

**6. TestPluginSettingsIntegration**
- End-to-end workflows
- Full cycle: get → update → verify → persist
- Multi-plugin updates

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py::TestPluginSettingsIntegration -v
```

### User Settings Tests (`test_user_settings.py`)

Tests user settings API and utility functions.

```bash
# All user settings tests
docker exec granite .venv/bin/pytest tests/test_user_settings.py -v

# Plugin persistence via user settings API
docker exec granite .venv/bin/pytest tests/test_user_settings.py::TestPluginSettingsPersistence -v
```

### Favorites Tests (`test_favorites.py`)

Tests the favorites feature for quick note access.

```bash
# All favorites tests
docker exec granite .venv/bin/pytest tests/test_favorites.py -v

# Specific test classes
docker exec granite .venv/bin/pytest tests/test_favorites.py::TestFavoritesAPI -v
docker exec granite .venv/bin/pytest tests/test_favorites.py::TestFavoritesWithOtherSettings -v
```

**Test Classes:**

- **TestFavoritesDefaultSettings** - Default settings include empty favorites array
- **TestFavoritesAPI** - Add, update, clear, and persist favorites via API
- **TestFavoritesWithOtherSettings** - Favorites work alongside other user settings
- **TestFavoritesFilePersistence** - Favorites are saved to user-settings.json
- **TestFavoritesEdgeCases** - Duplicates, special characters, large lists

### Frontend Tests (Browser-based)

HTML-based tests that run in the browser. Access via:
```
http://localhost:8000/tests/test_favorites_ui.html
http://localhost:8000/tests/test_plugin_ui.html
http://localhost:8000/tests/test_git_plugin_ui.html
```

**Note:** Requires `ENABLE_TESTS=true` environment variable to access test pages.

### Git Plugin Tests (`test_git_plugin.py`)

Tests Git plugin functionality.

```bash
docker exec granite .venv/bin/pytest tests/test_git_plugin.py -v
```

**Coverage**:
- Git command execution
- Backup timer
- SSH key generation
- Ignore patterns

### PDF Export Tests (`test_pdf_export_plugin.py`)

**Note**: Requires libpango. Always run in Docker.

```bash
docker exec granite .venv/bin/pytest tests/test_pdf_export_plugin.py -v
```

### Template Tests (`test_templates.py`)

Tests template system and placeholder replacement.

```bash
docker exec granite .venv/bin/pytest tests/test_templates.py -v
```

### Plugin API Tests (`test_plugin_api.py`)

Tests plugin manager and API endpoints.

```bash
docker exec granite .venv/bin/pytest tests/test_plugin_api.py -v
```

## Common Test Patterns

### Run By Pattern

```bash
# All tests with "persist" in name
docker exec granite .venv/bin/pytest -k "persist" -v

# All tests with "git" in name
docker exec granite .venv/bin/pytest -k "git" -v

# Integration tests only
docker exec granite .venv/bin/pytest -k "integration" -v
```

### Coverage Reports

```bash
# HTML report (opens in browser)
docker exec granite .venv/bin/pytest --cov=backend --cov=plugins --cov-report=html
# View: htmlcov/index.html

# Terminal report with missing lines
docker exec granite .venv/bin/pytest --cov=backend --cov=plugins --cov-report=term-missing

# XML report (for CI/CD)
docker exec granite .venv/bin/pytest --cov=backend --cov=plugins --cov-report=xml
```

### Verbose Output

```bash
# Show print statements
docker exec granite .venv/bin/pytest -v -s

# Extra verbose
docker exec granite .venv/bin/pytest -vv

# Show local variables on failure
docker exec granite .venv/bin/pytest -l
```

## Performance

### Typical Execution Times (Docker)

- **Full suite**: 30-60 seconds
- **Plugin settings**: 10-15 seconds
- **Single file**: 3-8 seconds
- **Single test**: <1 second

### Optimization

```bash
# Parallel execution (faster)
docker exec granite .venv/bin/pytest -n auto

# Run only failed tests
docker exec granite .venv/bin/pytest --lf

# Stop on first failure
docker exec granite .venv/bin/pytest -x
```

## Debugging Tests

### Interactive Debugging

```bash
# Drop into pdb on failure
docker exec granite .venv/bin/pytest --pdb

# Show local variables on failure
docker exec granite .venv/bin/pytest --showlocals

# Show print statements
docker exec granite .venv/bin/pytest -s
```

### Logging

```bash
# Show log output
docker exec granite .venv/bin/pytest --log-cli-level=DEBUG

# Capture warnings
docker exec granite .venv/bin/pytest -W all
```

## Troubleshooting

### Tests Skipping Locally

**Problem**: Tests skip due to missing dependencies (libpango)

**Solution**: Run in Docker
```bash
docker exec granite .venv/bin/pytest tests/ -v
```

### Plugin Not Found

**Problem**: Plugin tests fail with "plugin not available"

**Solutions**:
1. Check `plugins/plugin_config.json` - plugin must be enabled
2. Verify plugin file exists in `plugins/` directory
3. Check for import errors

```bash
# Check loaded plugins
docker exec granite python -c "from backend.plugins import PluginManager; pm = PluginManager('./plugins'); print(list(pm.plugins.keys()))"
```

### File Permission Errors

**Problem**: Tests fail to write to `user-settings.json`

**Solution**: Fix permissions
```bash
ls -la user-settings.json
chmod 644 user-settings.json
```

### Settings Not Persisting

**Problem**: Settings save but don't persist

**Solution**: Ensure volume mount in `docker-compose.yml`:
```yaml
volumes:
  - ./user-settings.json:/app/user-settings.json
```

Restart container:
```bash
docker-compose down
docker-compose up -d
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker-compose build
      - name: Run tests
        run: docker-compose run granite pytest --cov=backend --cov=plugins --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running tests..."
docker exec granite .venv/bin/pytest tests/ -v --tb=short

if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

## Writing New Tests

### Best Practices

1. **Descriptive names**: `test_git_settings_persist_after_update`
2. **AAA pattern**: Arrange, Act, Assert
3. **One thing per test**: Keep focused
4. **Use fixtures**: Avoid duplication
5. **Clean up**: Use fixtures with cleanup
6. **Skip gracefully**: `pytest.skip()` for unavailable features

### Example Test

```python
def test_feature_name(self, client, fixture1):
    """Test description explaining what and why"""
    # Arrange - Setup
    test_data = {"key": "value"}

    # Act - Execute
    response = client.post("/api/endpoint", json=test_data)

    # Assert - Verify
    assert response.status_code == 200
    assert response.json()["success"] is True
```

### Adding Plugin Settings Tests

When creating a new plugin with settings:

1. Automatically covered by `TestPluginSettingsGeneral`
2. Add plugin-specific class in `test_plugin_settings_persistence.py`
3. Test required fields
4. Test persistence to user-settings.json
5. Test edge cases

## Test Fixtures

### Common Fixtures

```python
@pytest.fixture
def client():
    """FastAPI test client"""

@pytest.fixture
def temp_settings_file():
    """Temporary user-settings.json"""

@pytest.fixture
def available_plugins(client):
    """List of available plugins"""

@pytest.fixture
def plugin_manager():
    """Plugin manager instance"""
```

## Quick Reference

```bash
# Most Used Commands

# Run all tests
docker exec granite .venv/bin/pytest -v

# Plugin settings tests
docker exec granite .venv/bin/pytest tests/test_plugin_settings_persistence.py -v

# With coverage
docker exec granite .venv/bin/pytest --cov=backend --cov=plugins -v

# Git tests only
docker exec granite .venv/bin/pytest -k "git" -v

# Debug mode
docker exec granite .venv/bin/pytest -x --pdb

# Parallel execution
docker exec granite .venv/bin/pytest -n auto -v
```

## Summary

- **100+ test cases** covering all features
- **70+ tests** for plugin settings persistence
- **30+ tests** for favorites, user settings, and other features
- **Frontend HTML tests** for browser-based testing
- **Comprehensive coverage** of all plugins
- **Docker-first** testing approach
- **Fast execution** with parallel support
- **Easy to extend** for new features

## Additional Resources

- [pytest documentation](https://docs.pytest.org/)
- [Plugin Development Guide](PLUGINS.md)
- [API Documentation](API.md)
- [Git Plugin Guide](PLUGIN_GIT_SYNC.md)

For detailed help:
```bash
docker exec granite .venv/bin/pytest --help
```
