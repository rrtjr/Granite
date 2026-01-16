# Granite Tests

This directory contains tests for the Granite application, specifically for the plugin management system.

> **For comprehensive testing documentation, see:**
> - **[docs/TESTING.md](../docs/TESTING.md)** - Complete test suite overview (70+ tests), running tests in Docker vs locally, coverage reports, troubleshooting
> - **[docs/TEST_ISOLATION.md](../docs/TEST_ISOLATION.md)** - How test isolation works, settings preservation, automatic backup/restore

## Test Files

### Backend Tests (Python)

**`test_plugin_settings_persistence.py`** NEW - Comprehensive plugin settings persistence tests (70+ tests)

Tests include:
- General plugin settings persistence (works for ANY plugin)
- Git plugin specific settings tests
- PDF Export plugin settings tests
- File system persistence verification
- Edge cases (null values, special characters, large objects)
- Integration tests (full workflows)
- Settings isolation between plugins

**`test_plugin_api.py`** - Tests for the plugin management API endpoints

Tests include:
- Listing all available plugins
- Plugin data structure validation
- Enabling plugins via API
- Disabling plugins via API
- Plugin state persistence
- Error handling for nonexistent plugins
- PluginManager class functionality

**`test_git_plugin.py`** - Tests for the Git Sync plugin

Tests include:
- Git plugin API endpoints (settings, status, manual backup/pull, SSH management)
- Settings management (get, update, persistence, git user config)
- Plugin unit tests (default settings, update settings, status)
- Git command execution (version check, repo detection, change detection)
- SSH key management (generate, retrieve public key, test connection)
- Integration tests with actual git operations
- Plugin lifecycle hooks (on_app_startup)
- Error handling for disabled plugin and non-git repos
- Git repository path verification (ensures operations only in data/ directory)

**`test_user_settings.py`** - Tests for the user settings system

Tests include:
- User settings utility functions (load, save, update, merge with defaults)
- User settings API endpoints (get, update)
- Templates directory settings persistence
- Plugin settings persistence to user-settings.json (Git, PDF Export)

### Frontend Tests (HTML/JavaScript)

**`test_plugin_ui.html`** - Interactive tests for the plugin UI

Tests include:
- API endpoint connectivity
- Plugin list retrieval
- Plugin structure validation
- Toggle plugin ON/OFF functionality
- State persistence across toggles
- Invalid plugin error handling

**`test_git_plugin_ui.html`** - Interactive tests for the Git plugin UI

Tests include:
- Get git plugin settings
- Update git plugin settings
- Get git plugin status
- Enable/disable git plugin
- Manual backup trigger
- Manual pull trigger
- Settings persistence

**`test_unsplash_banner.html`** - Interactive tests for the Unsplash banner picker

Tests include:
- Banner insertion into notes without frontmatter
- Banner insertion into existing frontmatter
- Updating existing banner field
- Preserving all frontmatter fields
- Handling empty content
- Handling URLs with special characters
- Banner field position handling (first/last)

## Running the Tests

### Quick Start (Recommended - Docker)

**The easiest way to run tests is inside Docker where all dependencies are installed:**

```bash
# Make sure your container is running
docker-compose up -d

# Run all tests
docker-compose exec granite .venv/bin/pytest tests/ -v

# Run with coverage
docker-compose exec granite .venv/bin/pytest tests/ --cov=backend --cov=plugins --cov-report=term-missing

# Run linting
docker-compose exec granite .venv/bin/ruff check backend/ plugins/ tests/
docker-compose exec granite .venv/bin/ruff format --check backend/ plugins/ tests/
```

### Local Development (with uv)

**Prerequisites:**
1. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh` (Linux/Mac) or see [uv docs](https://github.com/astral-sh/uv)
2. Set up environment: `uv sync`
3. Activate: `source .venv/bin/activate` (Linux/Mac) or `.venv\Scripts\activate` (Windows)

**Run tests locally:**
```bash
# From the granite root directory
pytest tests/ -v

# With coverage
pytest tests/ --cov=backend --cov=plugins --cov-report=term-missing --cov-report=html

# Run linting
ruff check backend/ plugins/ tests/
ruff format --check backend/ plugins/ tests/

# Auto-fix linting issues
ruff check --fix backend/ plugins/ tests/
ruff format backend/ plugins/ tests/
```

**Run specific tests:**
```bash
# Run specific test files
pytest tests/test_plugin_api.py -v
pytest tests/test_git_plugin.py -v
pytest tests/test_pdf_export_plugin.py -v

# Run specific test class
pytest tests/test_plugin_api.py::TestPluginAPI -v

# Run specific test
pytest tests/test_plugin_api.py::TestPluginAPI::test_list_plugins -v
```

### Frontend Tests (Browser)

**Prerequisites:**
- Granite app must be running with tests enabled

**Enable tests:**

Tests are disabled by default for security. To enable them:

1. Set the environment variable in your `.env` file:
   ```bash
   ENABLE_TESTS=true
   ```

2. Restart the container:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

**Run frontend tests:**

1. Make sure tests are enabled (you'll see a warning message in the logs)

2. Open the test page in your browser:
   ```
   http://localhost:8000/tests/test_plugin_ui.html
   http://localhost:8000/tests/test_git_plugin_ui.html
   http://localhost:8000/tests/test_unsplash_banner.html
   ```

3. Tests will run automatically on page load, or click **"Run All Tests"** to re-run

4. View test results in real-time:
   - Green = Passed
   - Red = Failed
   - Blue = Running
   - Gray = Skipped

**Security Note:** Always set `ENABLE_TESTS=false` in production to prevent exposing test files!

### Running Tests in Docker (Detailed)

All test dependencies (pytest, ruff, coverage tools, etc.) are included in the Docker image via the `.venv`.

**Run all tests:**
```bash
# Using docker-compose (recommended)
docker-compose exec granite .venv/bin/pytest tests/ -v

# Or using docker directly
docker exec granite .venv/bin/pytest /app/tests/ -v
```

**Run specific test files:**
```bash
docker-compose exec granite .venv/bin/pytest tests/test_plugin_api.py -v
docker-compose exec granite .venv/bin/pytest tests/test_pdf_export_plugin.py -v
```

**Run with coverage:**
```bash
docker-compose exec granite .venv/bin/pytest tests/ \
  --cov=backend \
  --cov=plugins \
  --cov-report=term-missing \
  --cov-report=html \
  --cov-report=xml
```

**Run linting:**
```bash
# Check for issues
docker-compose exec granite .venv/bin/ruff check backend/ plugins/ tests/

# Check formatting
docker-compose exec granite .venv/bin/ruff format --check backend/ plugins/ tests/

# Auto-fix issues
docker-compose exec granite .venv/bin/ruff check --fix backend/ plugins/ tests/
docker-compose exec granite .venv/bin/ruff format backend/ plugins/ tests/
```

**Enter container for interactive testing:**
```bash
docker exec -it granite sh
cd /app
.venv/bin/pytest tests/ -v
```

**Note:** All dependencies are installed in `.venv` inside the container, so use `.venv/bin/pytest` and `.venv/bin/ruff`.

## Test Coverage

### Plugin API Endpoints

| Endpoint | Method | Tested |
|----------|--------|--------|
| `/api/plugins` | GET | Yes |
| `/api/plugins/{plugin_name}/toggle` | POST | Yes |
| `/api/plugins/git/settings` | GET | Yes |
| `/api/plugins/git/settings` | POST | Yes |
| `/api/plugins/git/status` | GET | Yes |
| `/api/plugins/git/manual-backup` | POST | Yes |
| `/api/plugins/git/manual-pull` | POST | Yes |
| `/api/plugins/git/ssh/generate` | POST | Yes |
| `/api/plugins/git/ssh/public-key` | GET | Yes |
| `/api/plugins/git/ssh/test` | POST | Yes |

### Plugin Manager Functions

| Function | Tested |
|----------|--------|
| `list_plugins()` | Yes |
| `enable_plugin(name)` | Yes |
| `disable_plugin(name)` | Yes |

### Git Plugin Functions

| Function | Tested |
|----------|--------|
| `get_settings()` | Yes |
| `update_settings()` | Yes |
| `get_status()` | Yes |
| `_check_git_installed()` | Yes |
| `_check_is_git_repo()` | Yes |
| `_has_changes()` | Yes |
| `_run_git_command()` | Yes |
| `_configure_git_user()` | Yes |
| `manual_backup()` | Yes |
| `manual_pull()` | Yes |
| `generate_ssh_key()` | Yes |
| `get_ssh_public_key()` | Yes |
| `test_ssh_connection()` | Yes |
| `on_app_startup()` | Yes |

### Frontend Functionality

| Feature | Tested |
|---------|--------|
| Load plugin list | Yes |
| Display plugin info (name, version, status) | Yes |
| Toggle plugin ON | Yes |
| Toggle plugin OFF | Yes |
| State persistence | Yes |
| Error handling | Yes |
| Git settings modal | Yes |
| Update git settings | Yes |
| Manual backup trigger | Yes |
| Manual pull trigger | Yes |
| Git status display | Yes |
| Unsplash banner picker | Yes |
| Banner frontmatter insertion | Yes |

## Continuous Integration

To add these tests to CI/CD:

**GitHub Actions example** (`.github/workflows/test.yml`):
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          pip install pytest fastapi httpx
      - name: Run tests
        run: pytest tests/ -v
```

## Writing New Tests

### Backend Test Template

```python
def test_my_feature(client):
    """Test description"""
    response = client.get("/api/endpoint")
    assert response.status_code == 200
    data = response.json()
    assert "expected_key" in data
```

### Frontend Test Template

```javascript
async function testMyFeature() {
    testsTotal++;
    try {
        const response = await fetch(`${API_BASE}/api/endpoint`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Add assertions here

        displayTest('My Feature Test', 'pass', '✓ Test passed');
    } catch (error) {
        displayTest('My Feature Test', 'fail', `✗ ${error.message}`);
    }
}
```

## Troubleshooting

### Backend Tests Fail with Import Errors

Make sure you're running from the granite root directory:
```bash
cd /path/to/granite
pytest tests/test_plugin_api.py -v
```

### Frontend Tests Show Connection Errors

1. Verify the app is running: `docker-compose ps`
2. Check the app is accessible: `curl http://localhost:8000/api/plugins`
3. Make sure you're accessing the test page through the same host

### All Tests Skip

This means no plugins are installed. To test with plugins:
1. Make sure `note_stats.py` exists in `plugins/` directory
2. Restart the app: `docker-compose restart`
3. Run tests again

## Future Test Additions

Consider adding tests for:
- [x] Plugin configuration UI (Git plugin settings modal)
- [ ] Plugin hook execution (more comprehensive tests)
- [ ] Multiple concurrent plugin toggles
- [ ] Plugin loading on app startup (basic test exists)
- [ ] Plugin error handling (malformed plugins)
- [ ] Performance tests (loading many plugins)
- [ ] Integration tests with note operations
- [ ] Git plugin edge cases (merge conflicts, authentication failures)
- [ ] Settings validation (invalid intervals, malformed templates)

---

**Tip:** Run tests before committing changes to ensure everything works correctly!
