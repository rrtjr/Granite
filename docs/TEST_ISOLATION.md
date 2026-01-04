# Test Isolation and Settings Preservation

## Overview

All tests in this project are properly isolated and do not permanently modify your actual configuration files.

## How It Works

### Automatic Settings Backup (`conftest.py`)

The `tests/conftest.py` file contains a session-scoped fixture that **automatically**:

1. **Backs up** `user-settings.json` before any tests run
2. **Restores** the original settings after all tests complete

This happens automatically for ALL tests - you don't need to do anything.

### What Gets Preserved

- ✅ Git plugin settings (backup_interval, pull_on_startup, git_repo_path, etc.)
- ✅ PDF export plugin settings
- ✅ Note statistics plugin settings
- ✅ Reading preferences
- ✅ Performance settings
- ✅ All custom paths

### Test Run Flow

```
1. pytest starts
   ↓
2. conftest.py backs up user-settings.json → user-settings.json.backup
   ↓
3. All tests run (may modify settings)
   ↓
4. All tests complete
   ↓
5. conftest.py restores original user-settings.json
   ↓
6. Backup file is deleted
```

## Per-Test Restoration

If you need settings restored immediately after a specific test (not just at session end), use the `preserve_user_settings_per_test` fixture:

```python
def test_my_specific_test(preserve_user_settings_per_test):
    # Modify settings here
    # Settings will be restored immediately after this test completes
    pass
```

## Git Repository Isolation

Git plugin tests use the `temp_git_repo` fixture which:
- Creates a temporary git repository in `/tmp` or system temp directory
- Automatically cleans up after each test
- Never touches your actual data directory

## Verification

To verify settings are being preserved:

1. Note your current settings in `user-settings.json`
2. Run tests: `pytest tests/ -v`
3. Check `user-settings.json` - it should be unchanged

During test execution, you may see:
```
[conftest] Backed up user-settings.json to user-settings.json.backup
... tests run ...
[conftest] Restored original user-settings.json
[conftest] Removed backup file
```

## Manual Cleanup (if needed)

If tests are interrupted (Ctrl+C, crash), the backup file may remain:

```bash
# Check for backup
ls user-settings.json.backup

# Manually restore if needed
cp user-settings.json.backup user-settings.json
rm user-settings.json.backup
```

## Implementation Details

All test files that modify settings:
- `test_user_settings.py` - Uses temp files for utility tests, real file for API tests
- `test_plugin_settings_persistence.py` - Uses real file (protected by conftest.py)
- `test_git_plugin.py` - Uses temp git repo + real settings (protected by conftest.py)
- `test_pdf_export_plugin.py` - Uses real settings (protected by conftest.py)

The session-scoped `preserve_user_settings` fixture in `conftest.py` ensures all modifications are temporary.
