"""
Git Plugin for Granite
Automatically syncs your notes with a git repository.

Features:
- Auto-commit and push at configurable intervals
- Git pull on app startup to sync latest changes
- Configurable commit message templates
- Auto-stage all changes or only tracked files
- Configurable remote branch
- Optional auto-push (can be disabled for local-only commits)
- Skip backup if no changes detected
"""

import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path


class Plugin:
    def __init__(self):
        self.name = "Git Sync"
        self.version = "1.0.0"
        self.enabled = True

        # Default settings
        self.settings = {
            # Backup interval in seconds (default: 10 minutes)
            "backup_interval": 600,
            # Auto-pull on startup
            "pull_on_startup": True,
            # Auto-push to remote
            "auto_push": True,
            # Remote branch name
            "remote_branch": "main",
            # Stage all files (including untracked) or only tracked files
            "stage_all_files": True,
            # Commit message template (supports {timestamp} and {date})
            "commit_message_template": "Auto-backup: {timestamp}",
            # Skip backup if no changes detected
            "skip_if_no_changes": True,
            # Working directory (git repository root)
            # If None, uses the parent of notes directory
            "git_repo_path": None,
            # Git user configuration
            "git_user_name": "",
            "git_user_email": "",
            # Files/patterns to ignore in git status check
            "ignore_patterns": ["plugin_config.json", "__pycache__", "*.pyc"],
        }

        self.backup_thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.last_backup_time: datetime | None = None
        self.backup_count = 0

    def on_app_startup(self):
        """Initialize git sync on app startup"""
        print(f"[{self.name}] Starting up...")

        # Pull latest changes if enabled
        if self.settings["pull_on_startup"]:
            self._git_pull()

        # Start the backup timer thread
        self._start_backup_timer()

    def _get_git_repo_path(self) -> Path:
        """Get the git repository path"""
        if self.settings["git_repo_path"]:
            return Path(self.settings["git_repo_path"])

        # Default: use /app/data for Docker environments
        # This is where user notes are stored
        if Path("/app/data").exists():
            return Path("/app/data")

        # Fallback: use ./data relative to application root
        # plugins are in /app/plugins/, so parent.parent is /app/
        app_root = Path(__file__).parent.parent.resolve()
        data_dir = app_root / "data"

        # Safety check: prevent operating on application root
        if not data_dir.exists():
            print(f"[{self.name}] Warning: data directory not found at {data_dir}")
            print(f"[{self.name}] Creating data directory for git repository")
            data_dir.mkdir(parents=True, exist_ok=True)

        return data_dir

    def _run_git_command(self, command: list, capture_output=True) -> tuple[bool, str]:
        """
        Run a git command and return success status and output

        Args:
            command: Git command as list (e.g., ['git', 'status'])
            capture_output: Whether to capture output

        Returns:
            Tuple of (success: bool, output: str)
        """
        try:
            repo_path = self._get_git_repo_path()
            result = subprocess.run(
                command,
                cwd=repo_path,
                capture_output=capture_output,
                text=True,
                timeout=30,
                check=False,
            )

            if result.returncode == 0:
                return True, result.stdout if capture_output else ""
            error_msg = result.stderr if capture_output else ""
            print(f"[{self.name}] Git command failed: {' '.join(command)}")
            if error_msg:
                print(f"[{self.name}] Error: {error_msg}")
            return False, error_msg

        except subprocess.TimeoutExpired:
            print(f"[{self.name}] Git command timed out: {' '.join(command)}")
            return False, "Command timed out"
        except Exception as e:
            print(f"[{self.name}] Git command error: {e}")
            return False, str(e)

    def _check_git_installed(self) -> bool:
        """Check if git is installed and available"""
        success, _ = self._run_git_command(["git", "--version"])
        return success

    def _check_is_git_repo(self) -> bool:
        """Check if the current directory is a git repository"""
        success, _ = self._run_git_command(["git", "rev-parse", "--git-dir"])
        return success

    def _configure_git_user(self) -> bool:
        """
        Configure git user name and email if provided in settings

        Returns:
            True if git user is configured (either from settings or already set)
            False if git user is not configured and no settings provided
        """
        # Check if git user config is provided in settings
        user_name = self.settings.get("git_user_name", "").strip()
        user_email = self.settings.get("git_user_email", "").strip()

        # If both are provided, set them
        if user_name and user_email:
            print(f"[{self.name}] Configuring git user from plugin settings...")

            # Set user name
            success, _ = self._run_git_command(["git", "config", "user.name", user_name])
            if not success:
                print(f"[{self.name}] Failed to set git user.name")
                return False

            # Set user email
            success, _ = self._run_git_command(["git", "config", "user.email", user_email])
            if not success:
                print(f"[{self.name}] Failed to set git user.email")
                return False

            print(f"[{self.name}] Git user configured: {user_name} <{user_email}>")
            return True

        # If not provided in settings, check if already configured
        success, name_output = self._run_git_command(["git", "config", "user.name"])
        if not success or not name_output.strip():
            print(f"[{self.name}] Warning: Git user.name not configured")
            return False

        success, email_output = self._run_git_command(["git", "config", "user.email"])
        if not success or not email_output.strip():
            print(f"[{self.name}] Warning: Git user.email not configured")
            return False

        # User is already configured
        return True

    def _has_changes(self) -> bool:
        """Check if there are any changes to commit"""
        success, output = self._run_git_command(["git", "status", "--porcelain"])

        if not success:
            return False

        # Filter out ignored patterns
        lines = output.strip().split("\n")
        filtered_lines = []

        for line in lines:
            if not line.strip():
                continue

            # Check if line matches any ignore pattern
            should_ignore = False
            for pattern in self.settings["ignore_patterns"]:
                if pattern in line:
                    should_ignore = True
                    break

            if not should_ignore:
                filtered_lines.append(line)

        return len(filtered_lines) > 0

    def _git_pull(self):
        """Pull latest changes from remote"""
        if not self._check_git_installed():
            print(f"[{self.name}] Git is not installed. Skipping pull.")
            return

        if not self._check_is_git_repo():
            print(f"[{self.name}] Not a git repository. Skipping pull.")
            return

        print(f"[{self.name}] Pulling latest changes from remote...")

        # Fetch first
        success, _output = self._run_git_command(["git", "fetch"])
        if not success:
            print(f"[{self.name}] Failed to fetch from remote")
            return

        # Pull with rebase to avoid merge commits
        branch = self.settings["remote_branch"]
        success, _output = self._run_git_command(["git", "pull", "--rebase", "origin", branch])

        if success:
            print(f"[{self.name}] Successfully pulled from origin/{branch}")
        else:
            print(f"[{self.name}] Failed to pull from origin/{branch}")
            # Try to abort rebase if it failed
            self._run_git_command(["git", "rebase", "--abort"])

    def _git_commit_and_push(self):
        """Commit and push changes to remote"""
        if not self._check_git_installed():
            print(f"[{self.name}] Git is not installed. Skipping backup.")
            return

        if not self._check_is_git_repo():
            print(f"[{self.name}] Not a git repository. Skipping backup.")
            return

        # Configure git user if needed
        if not self._configure_git_user():
            print(f"[{self.name}] Git user not configured. Please set git_user_name and git_user_email in settings.")
            return

        # Check if there are changes
        if self.settings["skip_if_no_changes"] and not self._has_changes():
            print(f"[{self.name}] No changes detected. Skipping backup.")
            return

        print(f"[{self.name}] Starting backup...")

        # Stage files
        if self.settings["stage_all_files"]:
            # Stage all files including untracked
            success, _ = self._run_git_command(["git", "add", "-A"])
        else:
            # Stage only tracked files
            success, _ = self._run_git_command(["git", "add", "-u"])

        if not success:
            print(f"[{self.name}] Failed to stage files")
            return

        # Generate commit message
        now = datetime.now(timezone.utc)
        commit_message = self.settings["commit_message_template"].format(
            timestamp=now.strftime("%Y-%m-%d %H:%M:%S"),
            date=now.strftime("%Y-%m-%d"),
        )

        # Commit
        success, output = self._run_git_command(["git", "commit", "-m", commit_message])

        if not success:
            if "nothing to commit" in output.lower():
                print(f"[{self.name}] Nothing to commit")
            else:
                print(f"[{self.name}] Failed to commit changes")
            return

        print(f"[{self.name}] Committed: {commit_message}")
        self.backup_count += 1
        self.last_backup_time = now

        # Push if enabled
        if self.settings["auto_push"]:
            branch = self.settings["remote_branch"]
            success, _ = self._run_git_command(["git", "push", "origin", branch])

            if success:
                print(f"[{self.name}] Pushed to origin/{branch}")
            else:
                print(f"[{self.name}] Failed to push to origin/{branch}")

    def _backup_loop(self):
        """Background thread that performs periodic backups"""
        print(f"[{self.name}] Backup timer started (interval: {self.settings['backup_interval']}s)")

        while not self.stop_event.is_set():
            # Wait for the interval or until stop event
            if self.stop_event.wait(timeout=self.settings["backup_interval"]):
                break

            # Perform backup
            self._git_commit_and_push()

        print(f"[{self.name}] Backup timer stopped")

    def _start_backup_timer(self):
        """Start the background backup timer thread"""
        if self.backup_thread and self.backup_thread.is_alive():
            print(f"[{self.name}] Backup timer already running")
            return

        self.stop_event.clear()
        self.backup_thread = threading.Thread(target=self._backup_loop, daemon=True)
        self.backup_thread.start()

    def stop_backup_timer(self):
        """Stop the background backup timer thread"""
        if self.backup_thread and self.backup_thread.is_alive():
            print(f"[{self.name}] Stopping backup timer...")
            self.stop_event.set()
            self.backup_thread.join(timeout=5)

    def generate_ssh_key(self, email: str | None = None) -> tuple[bool, str]:
        """
        Generate SSH key for git authentication

        Args:
            email: Email to associate with the key

        Returns:
            Tuple of (success: bool, message: str)
        """
        ssh_dir = Path.home() / ".ssh"
        ssh_dir.mkdir(mode=0o700, exist_ok=True)

        key_path = ssh_dir / "id_ed25519"

        if key_path.exists():
            return False, "SSH key already exists at ~/.ssh/id_ed25519"

        email_arg = email or self.settings.get("git_user_email", "granite@localhost")

        try:
            result = subprocess.run(
                [
                    "ssh-keygen",
                    "-t",
                    "ed25519",
                    "-C",
                    email_arg,
                    "-f",
                    str(key_path),
                    "-N",
                    "",
                ],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

            if result.returncode == 0:
                return True, f"SSH key generated at {key_path}"
            return False, f"Failed to generate SSH key: {result.stderr}"
        except Exception as e:
            return False, f"Error generating SSH key: {e!s}"

    def get_ssh_public_key(self) -> tuple[bool, str]:
        """
        Get the public SSH key for adding to Git providers

        Returns:
            Tuple of (success: bool, public_key: str)
        """
        pub_key_path = Path.home() / ".ssh" / "id_ed25519.pub"

        if not pub_key_path.exists():
            return False, "No SSH public key found. Generate one first."

        try:
            return True, pub_key_path.read_text().strip()
        except Exception as e:
            return False, f"Error reading public key: {e!s}"

    def test_ssh_connection(self, host: str = "github.com") -> tuple[bool, str]:
        """
        Test SSH connection to a Git provider

        Args:
            host: Git provider host (e.g., github.com, gitlab.com)

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            result = subprocess.run(
                ["ssh", "-T", f"git@{host}", "-o", "StrictHostKeyChecking=no"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )

            # SSH to git providers returns exit code 1 even on success
            # Check the output message instead
            output = result.stdout + result.stderr

            if "successfully authenticated" in output.lower() or "welcome" in output.lower():
                return True, f"Successfully connected to {host}"
            if "permission denied" in output.lower():
                return False, f"Permission denied. Add your public key to {host}"
            return False, output
        except Exception as e:
            return False, f"Error testing SSH connection: {e!s}"

    def update_settings(self, new_settings: dict):
        """
        Update plugin settings

        Args:
            new_settings: Dictionary of settings to update
        """
        self.settings.update(new_settings)

        # If backup interval changed, restart the timer
        if "backup_interval" in new_settings:
            print(f"[{self.name}] Backup interval updated to {new_settings['backup_interval']}s")
            self.stop_backup_timer()
            self._start_backup_timer()

    def get_settings(self) -> dict:
        """Get current plugin settings"""
        return self.settings.copy()

    def get_status(self) -> dict:
        """Get current backup status"""
        return {
            "enabled": self.enabled,
            "backup_count": self.backup_count,
            "last_backup_time": self.last_backup_time.isoformat() if self.last_backup_time else None,
            "timer_running": self.backup_thread and self.backup_thread.is_alive(),
            "settings": self.get_settings(),
        }

    def manual_backup(self):
        """Manually trigger a backup (useful for testing)"""
        print(f"[{self.name}] Manual backup triggered")
        self._git_commit_and_push()

    def manual_pull(self):
        """Manually trigger a pull (useful for testing)"""
        print(f"[{self.name}] Manual pull triggered")
        self._git_pull()
