# Git Sync Plugin

The Git Sync plugin provides automatic version control and synchronization for your Granite notes using Git. It automatically commits and pushes your changes at configurable intervals, and syncs the latest changes when the application starts.

> **⚠️ IMPORTANT**: Before enabling this plugin, your **data folder must be a Git repository**. The plugin does not auto-initialize repositories. See the [Setup Guide](#setup-guide) section for instructions.

## Features

- **Automatic Backups**: Commits and pushes changes at configurable intervals
- **Auto-Pull on Startup**: Syncs latest changes from remote when app starts
- **Configurable Settings**: Customize backup interval, commit messages, and behavior
- **Manual Controls**: Trigger backup or pull operations on-demand
- **Smart Change Detection**: Skips commits when no changes are detected
- **Flexible Staging**: Choose to stage all files or only tracked files
- **Status Monitoring**: View backup count, last backup time, and timer status

## Requirements

- **Git** must be installed and available in the system PATH
  - ✅ **Docker users**: Git is automatically included in the Granite Docker image (v1.1.0+)
  - 🔧 **Local installation users**: Install Git manually (see [Installation](#installation) section)
- **The data directory (`/app/data`) must be a Git repository** ⚠️
  - The plugin does NOT auto-initialize repositories - see [Setup Guide](#setup-guide)
  - You must manually initialize or clone a repository before enabling the plugin
- Git repository must have a remote configured (for push/pull operations)
- Git user configuration (`user.name` and `user.email`) must be set
  - Can be configured via plugin settings UI or via git config command

## Installation

### Docker Installation (Recommended)

The Git Sync plugin is included with Granite and **Git is pre-installed** in the Docker image (v1.1.0+).

Simply enable it in the Settings panel:

1. Open Granite
2. Click the **Settings** icon in the sidebar
3. Scroll to the **Plugins** section
4. Toggle **Git Sync** to enable it
5. Click the **⚙️** (gear icon) to configure settings

### Local Installation (Without Docker)

If running Granite locally without Docker, you need to install Git manually:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install git
```

**macOS:**
```bash
brew install git
# Or download from https://git-scm.com/downloads
```

**Windows:**
- Download from [https://git-scm.com/downloads](https://git-scm.com/downloads)
- Or use `winget install Git.Git`

**Verify installation:**
```bash
git --version
```

Then enable the plugin in Granite Settings as described above.

## Setup Guide

**IMPORTANT**: The Git Sync plugin requires your **data folder** to be a Git repository. The plugin does not automatically initialize repositories - it works with existing ones.

### Initial Setup

Before enabling the plugin, you must set up your data directory as a Git repository:

#### Option 1: Initialize a New Repository

```bash
# Access the Docker container
docker exec -it granite bash

# Navigate to the data directory
cd /app/data

# Initialize git repository
git init

# Create initial commit
git add .
git commit -m "Initial commit"

# (Optional) Add a remote repository
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

**Note**: You can configure git user name and email either:
- **Via Plugin Settings** (recommended): Set `git_user_name` and `git_user_email` in the plugin settings UI
- **Via Git Config**: Run `git config user.name "Your Name"` and `git config user.email "your@email.com"` in the data directory

#### Option 2: Clone an Existing Repository

```bash
# Access the Docker container
docker exec -it granite bash

# Navigate to app directory
cd /app

# Backup existing data if any
mv data data_backup

# Clone your existing repository
git clone https://github.com/yourusername/your-repo.git data

# Restore any local files if needed
cp -r data_backup/* data/
rm -rf data_backup
```

### Verification

After setup, verify your git repository is configured correctly:

```bash
# Check git status
cd /app/data
git status

# Verify user configuration
git config user.name
git config user.email

# Check remote (if using push/pull)
git remote -v
```

### Testing the Plugin

Once your data folder is a git repository:

1. Enable the Git Sync plugin in Settings → Plugins
2. Click the **⚙️** (gear) icon to open settings
3. Click **Backup Now** to test manual backup
4. Check Docker logs: `docker logs granite`
5. Verify commit appears: `docker exec granite git -C /app/data log -1`

If commits are not appearing, check:
- Is `/app/data` a git repository? (`git status` should not show "not a git repository")
- Are there actual changes to commit? (create or modify a note first)
- Is git user configured? (`git config user.name` should show your name)
- Check Docker logs for error messages: `docker logs granite | grep "Git Sync"`

## Configuration

### Settings Overview

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `backup_interval` | Number | 600 | Auto-backup interval in seconds (600 = 10 minutes) |
| `pull_on_startup` | Boolean | true | Pull latest changes when app starts |
| `auto_push` | Boolean | true | Automatically push commits to remote |
| `remote_branch` | String | "main" | Git branch to sync with |
| `git_user_name` | String | "" | Git user name for commits (optional if already configured) |
| `git_user_email` | String | "" | Git user email for commits (optional if already configured) |
| `stage_all_files` | Boolean | true | Stage all files including untracked ones |
| `skip_if_no_changes` | Boolean | true | Skip backup if no changes detected |
| `commit_message_template` | String | "Auto-backup: {timestamp}" | Template for commit messages |
| `git_repo_path` | String | null | Custom git repository path (optional) |
| `ignore_patterns` | Array | `['plugin_config.json', '__pycache__', '*.pyc']` | Patterns to ignore in status check |

### Accessing Settings

**Via UI:**
1. Go to Settings → Plugins
2. Find "Git Sync" in the plugin list
3. Click the **⚙️** (gear) icon
4. Modify settings as needed
5. Click **Save Settings**

**Via API:**
```bash
# Get settings
curl http://localhost:8000/api/plugins/git/settings

# Update settings
curl -X POST http://localhost:8000/api/plugins/git/settings \
  -H "Content-Type: application/json" \
  -d '{"backup_interval": 300, "auto_push": false}'
```

### Git User Configuration

The plugin can automatically configure the git user name and email for commits:

**Option 1: Configure via Plugin Settings** (Recommended)

Set `git_user_name` and `git_user_email` in the plugin settings UI:
1. Open Settings → Plugins → Git Sync → ⚙️
2. Enter your name in "Git User Name"
3. Enter your email in "Git User Email"
4. Click "Save Settings"

The plugin will automatically run `git config user.name` and `git config user.email` before each commit.

**Option 2: Configure Manually via Git**

If you prefer to configure git directly:
```bash
docker exec -it granite bash
cd /app/data
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

Leave the plugin settings blank if you've configured git manually.

**Note**: If both settings are empty, the plugin will check if git user is already configured. If not, it will skip the backup and display a warning message.

### Commit Message Templates

The commit message template supports placeholders:

- `{timestamp}`: Full timestamp (YYYY-MM-DD HH:MM:SS)
- `{date}`: Date only (YYYY-MM-DD)

**Examples:**
```
"Auto-backup: {timestamp}"          → "Auto-backup: 2024-12-15 14:30:00"
"Notes updated on {date}"           → "Notes updated on 2024-12-15"
"Daily backup - {date} at {time}"   → Uses literal {time} (not replaced)
```

## Usage

### Automatic Backups

Once enabled, the plugin automatically:

1. Starts a background timer when the app launches
2. Checks for changes at the configured interval
3. Stages files according to the `stage_all_files` setting
4. Creates a commit with the configured message template
5. Pushes to the remote branch (if `auto_push` is enabled)

**Console Output:**
```
[Git Sync] Starting up...
[Git Sync] Pulling latest changes from remote...
[Git Sync] Successfully pulled from origin/main
[Git Sync] Backup timer started (interval: 600s)
[Git Sync] Starting backup...
[Git Sync] Committed: Auto-backup: 2024-12-15 14:30:00
[Git Sync] Pushed to origin/main
```

### Manual Operations

You can manually trigger git operations from the settings modal:

**Backup Now**: Immediately commit and push changes
**Pull Now**: Fetch and pull latest changes from remote

**Via UI:**
1. Open Settings → Plugins → Git Sync → ⚙️
2. Click **Backup Now** or **Pull Now**

**Via API:**
```bash
# Manual backup
curl -X POST http://localhost:8000/api/plugins/git/manual-backup

# Manual pull
curl -X POST http://localhost:8000/api/plugins/git/manual-pull
```

### Monitoring Status

View the current status in the settings modal:

- **Backups**: Total number of backups performed
- **Last backup**: Timestamp of the most recent backup
- **Timer**: Whether the backup timer is running

**Via API:**
```bash
curl http://localhost:8000/api/plugins/git/status
```

**Response:**
```json
{
  "enabled": true,
  "backup_count": 5,
  "last_backup_time": "2024-12-15T14:30:00",
  "timer_running": true,
  "settings": { ... }
}
```

## Common Scenarios

### Scenario 1: Local-Only Commits (No Push)

If you want to commit locally without pushing to a remote:

```json
{
  "auto_push": false
}
```

You can manually push later when ready.

### Scenario 2: More Frequent Backups

For more frequent backups (e.g., every 5 minutes):

```json
{
  "backup_interval": 300
}
```

### Scenario 3: Only Commit Tracked Files

To exclude untracked files from commits:

```json
{
  "stage_all_files": false
}
```

### Scenario 4: Different Branch

To sync with a different branch (e.g., `develop`):

```json
{
  "remote_branch": "develop"
}
```

### Scenario 5: Custom Repository Path

If your git repository is in a different location:

```json
{
  "git_repo_path": "/path/to/your/repo"
}
```

## Troubleshooting

### Git Not Installed

**Symptom**: Console shows "Git is not installed"

**Solution**: Install Git and ensure it's in your system PATH
```bash
# Check if git is installed
git --version

# Install git (Ubuntu/Debian)
sudo apt-get install git

# Install git (macOS)
brew install git

# Install git (Windows)
# Download from https://git-scm.com/downloads
```

### Not a Git Repository

**Symptom**: Console shows "Not a git repository" or clicking "Backup Now" doesn't create commits

**Solution**: Your data folder needs to be initialized as a git repository. The Git Sync plugin works with existing repositories and does not auto-initialize them.

See the [Setup Guide](#setup-guide) section above for detailed instructions on:
- Initializing a new repository in your data folder
- Cloning an existing repository
- Verifying your setup

**Quick Fix** (Docker users):
```bash
# Initialize git in the data directory
docker exec -it granite bash -c "cd /app/data && git init"

# Create initial commit
docker exec -it granite bash -c "cd /app/data && git add . && git commit -m 'Initial commit' --allow-empty"

# (Optional) Add remote and push
docker exec -it granite bash -c "cd /app/data && git remote add origin <your-repo-url> && git push -u origin main"
```

Then configure git user via the plugin settings UI (Settings → Plugins → Git Sync → ⚙️):
- Enter your name in "Git User Name"
- Enter your email in "Git User Email"
- Click "Save Settings"

Alternatively, configure git user via command line:
```bash
docker exec -it granite bash -c "cd /app/data && git config user.name 'Your Name' && git config user.email 'your@email.com'"
```

### Push Failed

**Symptom**: Console shows "Failed to push to origin/main" or "cannot run ssh: No such file or directory"

**Solution**: You need to configure Git authentication. See the comprehensive [Git Authentication Setup Guide](GIT_AUTHENTICATION.md) for detailed instructions.

**Quick Fixes:**

1. **No remote configured**
   ```bash
   docker exec granite bash -c "cd /app/data && git remote add origin <your-repo-url>"
   ```

2. **SSH not working** - Use HTTPS instead (easiest):
   ```bash
   # Change to HTTPS
   docker exec granite bash -c "cd /app/data && git remote set-url origin https://github.com/username/repo.git"

   # Configure credential helper
   docker exec granite git config --global credential.helper store

   # Push once (enter username and Personal Access Token when prompted)
   docker exec -it granite bash -c "cd /app/data && git push origin main"
   ```

3. **Want to use SSH** - See [Git Authentication Guide](GIT_AUTHENTICATION.md) for multiple SSH setup options:
   - Auto-generate SSH keys
   - Manual SSH setup
   - Mount existing SSH keys

4. **Remote branch doesn't exist**
   ```bash
   docker exec granite bash -c "cd /app/data && git push -u origin main"
   ```

5. **Diverged history**
   ```bash
   docker exec granite bash -c "cd /app/data && git pull --rebase origin main && git push origin main"
   ```

### Pull Failed

**Symptom**: Console shows "Failed to pull from origin/main"

**Solution**: The plugin automatically aborts failed rebases. Manually resolve:
```bash
cd /path/to/granite
git status
git rebase --abort  # Already done by plugin
git pull --no-rebase origin main
```

### No Changes Detected

**Symptom**: Backups are skipped with "No changes detected"

**This is normal behavior** when `skip_if_no_changes` is true. To force commits:

```json
{
  "skip_if_no_changes": false
}
```

Or make some changes to your notes first.

### Timer Not Running

**Symptom**: Status shows "Timer: Stopped"

**Possible Causes:**
1. Plugin is disabled - Enable it in Settings
2. App just started - Timer starts on `on_app_startup` hook
3. Settings were recently changed - Timer restarts automatically

**Solution**: Disable and re-enable the plugin, or restart the app.

## Security Considerations

### Sensitive Information

⚠️ **Warning**: The plugin commits all files in the notes directory. Be careful not to commit:

- API keys or tokens
- Passwords or credentials
- Private keys
- Personal identification information

**Recommendation**: Use `.gitignore` to exclude sensitive files:

```gitignore
# .gitignore in your notes directory
.env
secrets.md
private/
*.key
```

### Git Credentials

The plugin uses your system's Git configuration for authentication:

- **SSH**: Recommended for automated backups
- **HTTPS with credential helper**: Stores credentials securely
- **Personal Access Tokens**: Use for GitHub/GitLab

**Setup SSH** (Recommended):
```bash
# Generate key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Add public key to GitHub/GitLab/etc
cat ~/.ssh/id_ed25519.pub
```

## API Reference

### GET `/api/plugins/git/settings`

Get current git plugin settings.

**Response:**
```json
{
  "settings": {
    "backup_interval": 600,
    "pull_on_startup": true,
    "auto_push": true,
    "remote_branch": "main",
    "stage_all_files": true,
    "commit_message_template": "Auto-backup: {timestamp}",
    "skip_if_no_changes": true,
    "git_repo_path": null,
    "ignore_patterns": ["plugin_config.json", "__pycache__", "*.pyc"]
  }
}
```

### POST `/api/plugins/git/settings`

Update git plugin settings.

**Request Body:**
```json
{
  "backup_interval": 300,
  "auto_push": false
}
```

**Response:**
```json
{
  "success": true,
  "settings": { ... }
}
```

### GET `/api/plugins/git/status`

Get current git plugin status.

**Response:**
```json
{
  "enabled": true,
  "backup_count": 10,
  "last_backup_time": "2024-12-15T14:30:00",
  "timer_running": true,
  "settings": { ... }
}
```

### POST `/api/plugins/git/manual-backup`

Manually trigger a git backup.

**Response:**
```json
{
  "success": true,
  "message": "Manual backup triggered"
}
```

### POST `/api/plugins/git/manual-pull`

Manually trigger a git pull.

**Response:**
```json
{
  "success": true,
  "message": "Manual pull triggered"
}
```

## Advanced Usage

### Running in Docker

When running Granite in Docker, ensure:

1. Git is installed in the container
2. SSH keys are mounted (for authentication)
3. Git config is set in the container

**docker-compose.yml example:**
```yaml
services:
  granite:
    volumes:
      - ./data:/app/data
      - ~/.ssh:/root/.ssh:ro  # Mount SSH keys
      - ~/.gitconfig:/root/.gitconfig:ro  # Mount git config
    environment:
      - GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=no
```

### Custom Ignore Patterns

Add custom patterns to ignore:

```json
{
  "ignore_patterns": [
    "plugin_config.json",
    "__pycache__",
    "*.pyc",
    "*.tmp",
    ".DS_Store",
    "temp/"
  ]
}
```

### Pre-commit Hooks

The plugin respects Git hooks. You can add pre-commit hooks for:

- Linting markdown files
- Validating frontmatter
- Compressing images
- Running tests

**Example pre-commit hook** (`.git/hooks/pre-commit`):
```bash
#!/bin/bash
# Validate all markdown files
find . -name "*.md" -exec markdown-lint {} \;
```

## Testing

### Backend Tests

Run the plugin tests:
```bash
pytest tests/test_git_plugin.py -v
```

### Frontend Tests

Open the UI tests in your browser:
```
http://localhost:8000/tests/test_git_plugin_ui.html
```

## FAQ

**Q: Will this slow down my app?**
A: No, backups run in a background thread and don't block the main application.

**Q: What happens if a backup is in progress when I save a note?**
A: The backup process is independent. Your note save completes immediately. The next scheduled backup will include your changes.

**Q: Can I use this without a remote repository?**
A: Yes, set `auto_push: false` for local-only commits.

**Q: Does this support Git LFS?**
A: Yes, if Git LFS is configured in your repository.

**Q: Can I have different settings per repository?**
A: Settings are global per Granite instance. For different settings, run separate instances.

**Q: What if I manually commit changes?**
A: That's fine! The plugin will detect your manual commits and continue from there.

## Support

For issues or questions:
- GitHub Issues: https://github.com/rrtjr/Granite/issues
- Documentation: https://github.com/rrtjr/Granite/tree/main/documentation

## Related Documentation

- [Plugins Guide](PLUGINS.md)
- [API Reference](API.md)
- [Environment Variables](ENVIRONMENT_VARIABLES.md)
