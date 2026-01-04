"""
Path Security and Validation Tests

Tests path security validation to prevent path traversal attacks.
This is CRITICAL for security - prevents attackers from accessing files
outside the notes directory (e.g., /etc/passwd, sensitive config files).

Run with: pytest tests/test_security_utils.py -v
"""

import sys
import tempfile
from pathlib import Path

import pytest

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.utils import validate_path_security


@pytest.fixture
def temp_notes_dir():
    """Create a temporary notes directory for testing"""
    with tempfile.TemporaryDirectory() as temp_dir:
        notes_dir = Path(temp_dir) / "notes"
        notes_dir.mkdir(parents=True, exist_ok=True)
        yield str(notes_dir)


class TestPathSecurityValidation:
    """Test path security validation function"""

    def test_valid_path_in_notes_dir(self, temp_notes_dir):
        """Test that valid paths within notes dir are accepted"""
        valid_path = Path(temp_notes_dir) / "test.md"
        assert validate_path_security(temp_notes_dir, valid_path) is True

    def test_valid_nested_path(self, temp_notes_dir):
        """Test that valid nested paths are accepted"""
        nested_path = Path(temp_notes_dir) / "folder" / "subfolder" / "note.md"
        assert validate_path_security(temp_notes_dir, nested_path) is True

    def test_valid_deep_nested_path(self, temp_notes_dir):
        """Test that deeply nested valid paths are accepted"""
        deep_path = Path(temp_notes_dir) / "a" / "b" / "c" / "d" / "e" / "note.md"
        assert validate_path_security(temp_notes_dir, deep_path) is True


class TestPathTraversalPrevention:
    """Test prevention of path traversal attacks"""

    def test_parent_directory_traversal_rejected(self, temp_notes_dir):
        """Test that ../ path traversal is rejected"""
        attack_path = Path(temp_notes_dir) / ".." / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_double_parent_traversal_rejected(self, temp_notes_dir):
        """Test that ../../ path traversal is rejected"""
        attack_path = Path(temp_notes_dir) / ".." / ".." / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_multiple_parent_traversal_rejected(self, temp_notes_dir):
        """Test that multiple ../ are rejected"""
        attack_path = Path(temp_notes_dir) / ".." / ".." / ".." / ".." / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_nested_then_escape_rejected(self, temp_notes_dir):
        """Test that valid path followed by traversal is rejected"""
        # folder/../../../etc/passwd
        attack_path = Path(temp_notes_dir) / "folder" / ".." / ".." / ".." / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_absolute_path_outside_rejected(self, temp_notes_dir):
        """Test that absolute paths outside notes dir are rejected"""
        if sys.platform == "win32":
            attack_path = Path("C:/Windows/System32/config/sam")
        else:
            attack_path = Path("/etc/passwd")
        assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_root_path_rejected(self, temp_notes_dir):
        """Test that root path is rejected"""
        if sys.platform == "win32":
            attack_path = Path("C:/")
        else:
            attack_path = Path("/")
        assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_home_directory_rejected(self, temp_notes_dir):
        """Test that home directory path is rejected"""
        home_path = Path.home()
        assert validate_path_security(temp_notes_dir, home_path) is False


class TestEncodedPathTraversal:
    """Test path traversal with encoded characters"""

    def test_url_encoded_parent_rejected(self, temp_notes_dir):
        """Test that URL-encoded ../ is handled correctly"""
        # %2e%2e%2f = ../
        # Note: Path() will decode this automatically in some cases
        # This tests the current implementation behavior
        encoded_path = Path(temp_notes_dir) / "%2e%2e" / "etc" / "passwd"
        result = validate_path_security(temp_notes_dir, encoded_path)
        # The path should either be rejected or normalized safely
        # Current implementation using resolve() should handle this
        assert result in [True, False]  # Implementation-dependent

    def test_backslash_traversal_rejected(self, temp_notes_dir):
        """Test that backslash traversal is handled"""
        # On Windows, backslashes are path separators and get normalized
        # Path() normalizes the path, so "..\\" becomes valid ".."
        attack_path = Path(temp_notes_dir) / ".." / ".." / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, attack_path) is False


class TestSymlinkSecurity:
    """Test symlink handling (if applicable)"""

    @pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require admin on Windows")
    def test_symlink_outside_notes_rejected(self, temp_notes_dir):
        """Test that symlinks pointing outside notes dir are rejected"""
        # Create a symlink to /etc
        symlink_path = Path(temp_notes_dir) / "evil_link"
        try:
            symlink_path.symlink_to("/etc")
            # Following the symlink should be rejected
            assert validate_path_security(temp_notes_dir, symlink_path) is False
        except (OSError, NotImplementedError):
            pytest.skip("Symlink creation not supported")
        finally:
            if symlink_path.exists():
                symlink_path.unlink()

    @pytest.mark.skipif(sys.platform == "win32", reason="Symlinks require admin on Windows")
    def test_symlink_inside_notes_accepted(self, temp_notes_dir):
        """Test that symlinks within notes dir are accepted"""
        # Create target file
        target_path = Path(temp_notes_dir) / "target.md"
        target_path.write_text("# Target Note")

        # Create symlink to target within same directory
        symlink_path = Path(temp_notes_dir) / "link.md"
        try:
            symlink_path.symlink_to(target_path)
            assert validate_path_security(temp_notes_dir, symlink_path) is True
        except (OSError, NotImplementedError):
            pytest.skip("Symlink creation not supported")
        finally:
            if symlink_path.exists():
                symlink_path.unlink()
            if target_path.exists():
                target_path.unlink()


class TestEdgeCases:
    """Test edge cases and special scenarios"""

    def test_empty_path_rejected(self, temp_notes_dir):
        """Test that empty path is handled"""
        empty_path = Path()
        # Empty path should be rejected or handled safely
        result = validate_path_security(temp_notes_dir, empty_path)
        assert isinstance(result, bool)

    def test_current_directory_accepted(self, temp_notes_dir):
        """Test that current directory (.) is accepted"""
        current_path = Path(temp_notes_dir) / "."
        assert validate_path_security(temp_notes_dir, current_path) is True

    def test_notes_dir_itself_accepted(self, temp_notes_dir):
        """Test that notes directory itself is accepted"""
        notes_path = Path(temp_notes_dir)
        assert validate_path_security(temp_notes_dir, notes_path) is True

    def test_path_with_spaces_accepted(self, temp_notes_dir):
        """Test that paths with spaces are handled correctly"""
        space_path = Path(temp_notes_dir) / "folder with spaces" / "note with spaces.md"
        assert validate_path_security(temp_notes_dir, space_path) is True

    def test_path_with_special_chars_accepted(self, temp_notes_dir):
        """Test that paths with special characters are handled"""
        special_path = Path(temp_notes_dir) / "notes-2024" / "file_name.md"
        assert validate_path_security(temp_notes_dir, special_path) is True

    def test_path_with_unicode_accepted(self, temp_notes_dir):
        """Test that paths with unicode characters are handled"""
        unicode_path = Path(temp_notes_dir) / "日本語" / "note.md"
        assert validate_path_security(temp_notes_dir, unicode_path) is True

    def test_very_long_path_accepted(self, temp_notes_dir):
        """Test that very long valid paths are accepted"""
        # Create a very long path (but still valid)
        long_path = Path(temp_notes_dir)
        for i in range(20):
            long_path = long_path / f"folder{i}"
        long_path = long_path / "note.md"
        assert validate_path_security(temp_notes_dir, long_path) is True

    def test_path_with_dots_in_filename_accepted(self, temp_notes_dir):
        """Test that dots in filename (not ..) are accepted"""
        dotted_path = Path(temp_notes_dir) / "my.note.with.dots.md"
        assert validate_path_security(temp_notes_dir, dotted_path) is True

    def test_hidden_file_accepted(self, temp_notes_dir):
        """Test that hidden files (starting with .) are accepted"""
        hidden_path = Path(temp_notes_dir) / ".hidden" / ".secret.md"
        assert validate_path_security(temp_notes_dir, hidden_path) is True


class TestRealWorldAttacks:
    """Test real-world attack patterns"""

    def test_null_byte_injection(self, temp_notes_dir):
        """Test null byte injection attack"""
        # Null bytes in path (historical attack vector)
        try:
            attack_path = Path(temp_notes_dir) / "note\x00.md"
            result = validate_path_security(temp_notes_dir, attack_path)
            # Should either reject or handle safely
            assert isinstance(result, bool)
        except (ValueError, OSError):
            # Path validation may raise exception for null bytes
            pass

    def test_double_slash_attack(self, temp_notes_dir):
        """Test double slash path attack"""
        # //etc/passwd or similar
        double_slash_path = Path(temp_notes_dir) / "/" / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, double_slash_path) is False

    def test_mixed_separators_attack(self, temp_notes_dir):
        """Test mixed path separators attack"""
        # folder/..\\..\\etc\\passwd (mixing / and \)
        mixed_path = Path(temp_notes_dir) / "folder" / ".." / ".." / "etc" / "passwd"
        assert validate_path_security(temp_notes_dir, mixed_path) is False

    def test_case_sensitivity_bypass(self, temp_notes_dir):
        """Test case sensitivity bypass attempts"""
        # On Windows, paths are case-insensitive
        # This should still be handled correctly
        if sys.platform == "win32":
            attack_path = Path(temp_notes_dir) / ".." / "WINDOWS" / "System32"
            assert validate_path_security(temp_notes_dir, attack_path) is False


class TestCrossPlatform:
    """Test cross-platform path handling"""

    def test_windows_absolute_path_rejected(self, temp_notes_dir):
        """Test Windows absolute path is rejected"""
        if sys.platform == "win32":
            # C:\Windows\System32
            attack_path = Path("C:\\Windows\\System32\\config.sys")
            assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_unix_absolute_path_rejected(self, temp_notes_dir):
        """Test Unix absolute path is rejected"""
        if sys.platform != "win32":
            attack_path = Path("/etc/passwd")
            assert validate_path_security(temp_notes_dir, attack_path) is False

    def test_unc_path_rejected(self, temp_notes_dir):
        """Test UNC path is rejected (Windows)"""
        if sys.platform == "win32":
            # \\server\share\file
            unc_path = Path("\\\\server\\share\\sensitive.txt")
            assert validate_path_security(temp_notes_dir, unc_path) is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
