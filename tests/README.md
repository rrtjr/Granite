# Tests

This directory contains tests for the Granite application, specifically for the plugin management system.

## Test Files

### Backend Tests (Python)

**`test_plugin_api.py`** - Tests for the plugin management API endpoints

Tests include:
- ✅ Listing all available plugins
- ✅ Plugin data structure validation
- ✅ Enabling plugins via API
- ✅ Disabling plugins via API
- ✅ Plugin state persistence
- ✅ Error handling for nonexistent plugins
- ✅ PluginManager class functionality

**`test_git_plugin.py`** - Tests for the Git Sync plugin

Tests include:
- ✅ Git plugin API endpoints (settings, status, manual backup/pull, SSH management)
- ✅ Settings management (get, update, persistence, git user config)
- ✅ Plugin unit tests (default settings, update settings, status)
- ✅ Git command execution (version check, repo detection, change detection)
- ✅ SSH key management (generate, retrieve public key, test connection)
- ✅ Integration tests with actual git operations
- ✅ Plugin lifecycle hooks (on_app_startup)
- ✅ Error handling for disabled plugin and non-git repos

### Frontend Tests (HTML/JavaScript)

**`test_plugin_ui.html`** - Interactive tests for the plugin UI

Tests include:
- ✅ API endpoint connectivity
- ✅ Plugin list retrieval
- ✅ Plugin structure validation
- ✅ Toggle plugin ON/OFF functionality
- ✅ State persistence across toggles
- ✅ Invalid plugin error handling

**`test_git_plugin_ui.html`** - Interactive tests for the Git plugin UI

Tests include:
- ✅ Get git plugin settings
- ✅ Update git plugin settings
- ✅ Get git plugin status
- ✅ Enable/disable git plugin
- ✅ Manual backup trigger
- ✅ Manual pull trigger
- ✅ Settings persistence

## Running the Tests

### Quick Start (Recommended)

**The easiest way to run tests is using the provided scripts:**

**Linux/Mac:**
```bash
./scripts/run_tests.sh
```

**Windows:**
```batch
scripts\run_tests.bat
```

These scripts will:
1. Check if the Granite container is running
2. Run all backend tests inside the container
3. Show you the URL for frontend tests

**Note:** On Linux/Mac, ensure the script has Unix (LF) line endings. If edited on Windows, convert with: `sed -i 's/\r$//' scripts/run_tests.sh && chmod +x scripts/run_tests.sh`

### Backend Tests (pytest)

**Prerequisites (if running outside Docker):**
```bash
pip install pytest fastapi httpx
```

**Run all backend tests:**
```bash
# From the granite root directory
pytest tests/ -v

# Or run specific test files
pytest tests/test_plugin_api.py -v
pytest tests/test_git_plugin.py -v
```

**Run specific test class:**
```bash
pytest tests/test_plugin_api.py::TestPluginAPI -v
pytest tests/test_git_plugin.py::TestGitPluginAPI -v
```

**Run specific test:**
```bash
pytest tests/test_plugin_api.py::TestPluginAPI::test_list_plugins -v
pytest tests/test_git_plugin.py::TestGitPluginAPI::test_get_git_settings -v
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
   ```

3. Tests will run automatically on page load, or click **"Run All Tests"** to re-run

4. View test results in real-time:
   - ✅ Green = Passed
   - ❌ Red = Failed
   - ℹ️ Blue = Running
   - ⊘ Gray = Skipped

**⚠️ Security Note:** Always set `ENABLE_TESTS=false` in production to prevent exposing test files!

### Running Tests in Docker

The backend tests are automatically available inside the Docker container.

**Option 1: Use the provided script (recommended)**
```bash
# Linux/Mac
./scripts/run_tests.sh

# Windows
scripts\run_tests.bat
```

**Option 2: Run directly in the container**
```bash
# Run all tests without entering the container
docker exec granite pytest /app/tests/ -v

# Run specific test files
docker exec granite pytest /app/tests/test_plugin_api.py -v
docker exec granite pytest /app/tests/test_git_plugin.py -v

# Or enter the container and run tests
docker exec -it granite bash
pytest /app/tests/ -v
```

**Note:** pytest and httpx are now included in the Docker image, so no additional installation is needed!

## Test Coverage

### Plugin API Endpoints

| Endpoint | Method | Tested |
|----------|--------|--------|
| `/api/plugins` | GET | ✅ |
| `/api/plugins/{plugin_name}/toggle` | POST | ✅ |
| `/api/plugins/git/settings` | GET | ✅ |
| `/api/plugins/git/settings` | POST | ✅ |
| `/api/plugins/git/status` | GET | ✅ |
| `/api/plugins/git/manual-backup` | POST | ✅ |
| `/api/plugins/git/manual-pull` | POST | ✅ |
| `/api/plugins/git/ssh/generate` | POST | ✅ |
| `/api/plugins/git/ssh/public-key` | GET | ✅ |
| `/api/plugins/git/ssh/test` | POST | ✅ |

### Plugin Manager Functions

| Function | Tested |
|----------|--------|
| `list_plugins()` | ✅ |
| `enable_plugin(name)` | ✅ |
| `disable_plugin(name)` | ✅ |

### Git Plugin Functions

| Function | Tested |
|----------|--------|
| `get_settings()` | ✅ |
| `update_settings()` | ✅ |
| `get_status()` | ✅ |
| `_check_git_installed()` | ✅ |
| `_check_is_git_repo()` | ✅ |
| `_has_changes()` | ✅ |
| `_run_git_command()` | ✅ |
| `_configure_git_user()` | ✅ |
| `manual_backup()` | ✅ |
| `manual_pull()` | ✅ |
| `generate_ssh_key()` | ✅ |
| `get_ssh_public_key()` | ✅ |
| `test_ssh_connection()` | ✅ |
| `on_app_startup()` | ✅ |

### Frontend Functionality

| Feature | Tested |
|---------|--------|
| Load plugin list | ✅ |
| Display plugin info (name, version, status) | ✅ |
| Toggle plugin ON | ✅ |
| Toggle plugin OFF | ✅ |
| State persistence | ✅ |
| Error handling | ✅ |
| Git settings modal | ✅ |
| Update git settings | ✅ |
| Manual backup trigger | ✅ |
| Manual pull trigger | ✅ |
| Git status display | ✅ |

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

💡 **Tip:** Run tests before committing changes to ensure everything works correctly!
