"""
Core File Operations Tests

Tests critical file operations for data integrity and security:
- Note CRUD (create, read, update, delete)
- Folder CRUD
- Note moving/renaming
- Folder moving/renaming
- Special characters and edge cases

Run with: pytest tests/test_file_operations.py -v
"""

import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.utils import (
    create_folder,
    delete_folder,
    delete_note,
    get_note_content,
    move_folder,
    move_note,
    rename_folder,
    save_note,
)


@pytest.fixture
def temp_notes_dir():
    """Create a temporary notes directory for testing"""
    with tempfile.TemporaryDirectory() as temp_dir:
        notes_dir = Path(temp_dir) / "notes"
        notes_dir.mkdir(parents=True, exist_ok=True)
        yield str(notes_dir)


@pytest.fixture
def notes_dir_with_sample_notes(temp_notes_dir):
    """Create notes directory with sample notes"""
    save_note(temp_notes_dir, "note1.md", "# Note 1\nContent")
    save_note(temp_notes_dir, "note2.md", "# Note 2\nMore content")
    save_note(temp_notes_dir, "folder1/note3.md", "# Note 3\nNested content")
    save_note(temp_notes_dir, "folder1/subfolder/note4.md", "# Note 4\nDeep nested")
    yield temp_notes_dir


class TestSaveNote:
    """Test note saving functionality"""

    def test_save_new_note(self, temp_notes_dir):
        """Test creating a new note"""
        content = "# Test Note\nThis is test content"
        result = save_note(temp_notes_dir, "test.md", content)
        assert result is True

        note_path = Path(temp_notes_dir) / "test.md"
        assert note_path.exists()
        assert note_path.read_text(encoding="utf-8") == content

    def test_save_note_creates_parent_dirs(self, temp_notes_dir):
        """Test that parent directories are created automatically"""
        result = save_note(temp_notes_dir, "folder/subfolder/note.md", "# Content")
        assert result is True

        note_path = Path(temp_notes_dir) / "folder" / "subfolder" / "note.md"
        assert note_path.exists()
        assert note_path.parent.exists()

    def test_save_note_adds_md_extension(self, temp_notes_dir):
        """Test that .md extension is added if missing"""
        result = save_note(temp_notes_dir, "test", "# Content")
        assert result is True

        note_path = Path(temp_notes_dir) / "test.md"
        assert note_path.exists()

    def test_update_existing_note(self, temp_notes_dir):
        """Test updating an existing note"""
        save_note(temp_notes_dir, "test.md", "# Original")

        new_content = "# Updated\nNew content"
        result = save_note(temp_notes_dir, "test.md", new_content)
        assert result is True

        note_path = Path(temp_notes_dir) / "test.md"
        assert note_path.read_text(encoding="utf-8") == new_content

    def test_save_empty_note(self, temp_notes_dir):
        """Test saving a note with empty content"""
        result = save_note(temp_notes_dir, "empty.md", "")
        assert result is True

        note_path = Path(temp_notes_dir) / "empty.md"
        assert note_path.exists()
        assert note_path.read_text(encoding="utf-8") == ""

    def test_save_note_with_unicode(self, temp_notes_dir):
        """Test saving note with unicode content"""
        unicode_content = "# Unicode Test\n你好世界\nこんにちは\n안녕하세요"
        result = save_note(temp_notes_dir, "unicode.md", unicode_content)
        assert result is True

        note_path = Path(temp_notes_dir) / "unicode.md"
        assert note_path.read_text(encoding="utf-8") == unicode_content

    def test_save_note_path_traversal_rejected(self, temp_notes_dir):
        """Test that path traversal attacks are rejected"""
        result = save_note(temp_notes_dir, "../../../etc/passwd.md", "attack")
        assert result is False

        attack_path = Path(temp_notes_dir).parent.parent.parent / "etc" / "passwd.md"
        assert not attack_path.exists()


class TestGetNoteContent:
    """Test note reading functionality"""

    def test_get_existing_note(self, notes_dir_with_sample_notes):
        """Test reading an existing note"""
        content = get_note_content(notes_dir_with_sample_notes, "note1.md")
        assert content == "# Note 1\nContent"

    def test_get_nested_note(self, notes_dir_with_sample_notes):
        """Test reading a nested note"""
        content = get_note_content(notes_dir_with_sample_notes, "folder1/note3.md")
        assert content == "# Note 3\nNested content"

    def test_get_nonexistent_note(self, temp_notes_dir):
        """Test reading a note that doesn't exist"""
        content = get_note_content(temp_notes_dir, "nonexistent.md")
        assert content is None

    def test_get_note_path_traversal_rejected(self, temp_notes_dir):
        """Test that path traversal is rejected when reading"""
        content = get_note_content(temp_notes_dir, "../../../etc/passwd")
        assert content is None

    def test_get_directory_rejected(self, temp_notes_dir):
        """Test that reading a directory returns None"""
        folder_path = Path(temp_notes_dir) / "testfolder"
        folder_path.mkdir()

        content = get_note_content(temp_notes_dir, "testfolder")
        assert content is None


class TestDeleteNote:
    """Test note deletion functionality"""

    def test_delete_existing_note(self, notes_dir_with_sample_notes):
        """Test deleting an existing note"""
        result = delete_note(notes_dir_with_sample_notes, "note1.md")
        assert result is True

        note_path = Path(notes_dir_with_sample_notes) / "note1.md"
        assert not note_path.exists()

    def test_delete_nested_note(self, notes_dir_with_sample_notes):
        """Test deleting a nested note"""
        result = delete_note(notes_dir_with_sample_notes, "folder1/note3.md")
        assert result is True

        note_path = Path(notes_dir_with_sample_notes) / "folder1" / "note3.md"
        assert not note_path.exists()

        folder_path = Path(notes_dir_with_sample_notes) / "folder1"
        assert folder_path.exists()

    def test_delete_nonexistent_note(self, temp_notes_dir):
        """Test deleting a note that doesn't exist"""
        result = delete_note(temp_notes_dir, "nonexistent.md")
        assert result is False

    def test_delete_path_traversal_rejected(self, temp_notes_dir):
        """Test that path traversal is rejected when deleting"""
        result = delete_note(temp_notes_dir, "../../../important.md")
        assert result is False


class TestMoveNote:
    """Test note moving/renaming functionality"""

    def test_move_note_same_folder(self, notes_dir_with_sample_notes):
        """Test renaming a note in the same folder"""
        result = move_note(notes_dir_with_sample_notes, "note1.md", "renamed.md")
        assert result is True

        old_path = Path(notes_dir_with_sample_notes) / "note1.md"
        assert not old_path.exists()

        new_path = Path(notes_dir_with_sample_notes) / "renamed.md"
        assert new_path.exists()
        assert new_path.read_text(encoding="utf-8") == "# Note 1\nContent"

    def test_move_note_to_different_folder(self, notes_dir_with_sample_notes):
        """Test moving a note to a different folder"""
        result = move_note(notes_dir_with_sample_notes, "note1.md", "folder1/note1.md")
        assert result is True

        old_path = Path(notes_dir_with_sample_notes) / "note1.md"
        assert not old_path.exists()

        new_path = Path(notes_dir_with_sample_notes) / "folder1" / "note1.md"
        assert new_path.exists()

    def test_move_note_creates_target_folder(self, notes_dir_with_sample_notes):
        """Test that moving creates target folder if it doesn't exist"""
        result = move_note(notes_dir_with_sample_notes, "note1.md", "newfolder/note1.md")
        assert result is True

        new_path = Path(notes_dir_with_sample_notes) / "newfolder" / "note1.md"
        assert new_path.exists()
        assert new_path.parent.exists()

    def test_move_nonexistent_note(self, temp_notes_dir):
        """Test moving a note that doesn't exist"""
        result = move_note(temp_notes_dir, "nonexistent.md", "new.md")
        assert result is False

    def test_move_note_path_traversal_rejected(self, notes_dir_with_sample_notes):
        """Test that path traversal is rejected when moving"""
        result = move_note(notes_dir_with_sample_notes, "note1.md", "../../../evil.md")
        assert result is False

        original = Path(notes_dir_with_sample_notes) / "note1.md"
        assert original.exists()


class TestCreateFolder:
    """Test folder creation functionality"""

    def test_create_folder(self, temp_notes_dir):
        """Test creating a new folder"""
        result = create_folder(temp_notes_dir, "testfolder")
        assert result is True

        folder_path = Path(temp_notes_dir) / "testfolder"
        assert folder_path.exists()
        assert folder_path.is_dir()

    def test_create_nested_folder(self, temp_notes_dir):
        """Test creating nested folders"""
        result = create_folder(temp_notes_dir, "folder/subfolder/deep")
        assert result is True

        folder_path = Path(temp_notes_dir) / "folder" / "subfolder" / "deep"
        assert folder_path.exists()
        assert folder_path.is_dir()

    def test_create_existing_folder(self, temp_notes_dir):
        """Test creating a folder that already exists"""
        create_folder(temp_notes_dir, "testfolder")
        result = create_folder(temp_notes_dir, "testfolder")
        assert result is True

    def test_create_folder_path_traversal_rejected(self, temp_notes_dir):
        """Test that path traversal is rejected when creating folders"""
        result = create_folder(temp_notes_dir, "../../../evil")
        assert result is False


class TestDeleteFolder:
    """Test folder deletion functionality"""

    def test_delete_empty_folder(self, temp_notes_dir):
        """Test deleting an empty folder"""
        folder_path = Path(temp_notes_dir) / "testfolder"
        folder_path.mkdir()

        result = delete_folder(temp_notes_dir, "testfolder")
        assert result is True
        assert not folder_path.exists()

    def test_delete_folder_with_notes(self, notes_dir_with_sample_notes):
        """Test deleting a folder containing notes"""
        result = delete_folder(notes_dir_with_sample_notes, "folder1")
        assert result is True

        folder_path = Path(notes_dir_with_sample_notes) / "folder1"
        assert not folder_path.exists()

        note_path = folder_path / "note3.md"
        assert not note_path.exists()

    def test_delete_nested_folder(self, temp_notes_dir):
        """Test deleting a nested folder"""
        create_folder(temp_notes_dir, "parent/child")

        result = delete_folder(temp_notes_dir, "parent/child")
        assert result is True

        child_path = Path(temp_notes_dir) / "parent" / "child"
        assert not child_path.exists()

        parent_path = Path(temp_notes_dir) / "parent"
        assert parent_path.exists()

    def test_delete_nonexistent_folder(self, temp_notes_dir):
        """Test deleting a folder that doesn't exist"""
        result = delete_folder(temp_notes_dir, "nonexistent")
        assert result is False

    def test_delete_folder_path_traversal_rejected(self, temp_notes_dir):
        """Test that path traversal is rejected when deleting folders"""
        result = delete_folder(temp_notes_dir, "../../../important")
        assert result is False


class TestMoveFolder:
    """Test folder moving functionality"""

    def test_move_folder_same_level(self, notes_dir_with_sample_notes):
        """Test moving a folder to a different name at same level"""
        result = move_folder(notes_dir_with_sample_notes, "folder1", "renamed_folder")
        assert result is True

        old_path = Path(notes_dir_with_sample_notes) / "folder1"
        assert not old_path.exists()

        new_path = Path(notes_dir_with_sample_notes) / "renamed_folder"
        assert new_path.exists()

        note_path = new_path / "note3.md"
        assert note_path.exists()

    def test_move_folder_to_nested_location(self, notes_dir_with_sample_notes):
        """Test moving a folder to a nested location"""
        create_folder(notes_dir_with_sample_notes, "target")

        result = move_folder(notes_dir_with_sample_notes, "folder1", "target/folder1")
        assert result is True

        new_path = Path(notes_dir_with_sample_notes) / "target" / "folder1"
        assert new_path.exists()

    def test_move_nonexistent_folder(self, temp_notes_dir):
        """Test moving a folder that doesn't exist"""
        result = move_folder(temp_notes_dir, "nonexistent", "new")
        assert result is False

    def test_move_folder_path_traversal_rejected(self, notes_dir_with_sample_notes):
        """Test that path traversal is rejected when moving folders"""
        result = move_folder(notes_dir_with_sample_notes, "folder1", "../../../evil")
        assert result is False


class TestRenameFolder:
    """Test folder renaming functionality"""

    def test_rename_folder(self, notes_dir_with_sample_notes):
        """Test renaming a folder"""
        result = rename_folder(notes_dir_with_sample_notes, "folder1", "new_name")
        assert result is True

        old_path = Path(notes_dir_with_sample_notes) / "folder1"
        assert not old_path.exists()

        new_path = Path(notes_dir_with_sample_notes) / "new_name"
        assert new_path.exists()


class TestSpecialCharacters:
    """Test file operations with special characters"""

    def test_note_with_spaces_in_name(self, temp_notes_dir):
        """Test notes with spaces in filename"""
        content = "# Test"
        result = save_note(temp_notes_dir, "note with spaces.md", content)
        assert result is True

        retrieved = get_note_content(temp_notes_dir, "note with spaces.md")
        assert retrieved == content

    def test_folder_with_spaces(self, temp_notes_dir):
        """Test folders with spaces in name"""
        result = create_folder(temp_notes_dir, "folder with spaces")
        assert result is True

        folder_path = Path(temp_notes_dir) / "folder with spaces"
        assert folder_path.exists()

    def test_note_with_unicode_filename(self, temp_notes_dir):
        """Test notes with unicode characters in filename"""
        content = "# Unicode filename test"
        result = save_note(temp_notes_dir, "日本語ノート.md", content)
        assert result is True

        retrieved = get_note_content(temp_notes_dir, "日本語ノート.md")
        assert retrieved == content

    def test_note_with_special_chars(self, temp_notes_dir):
        """Test notes with special characters in filename"""
        content = "# Special"
        result = save_note(temp_notes_dir, "note-2024_test.md", content)
        assert result is True

        retrieved = get_note_content(temp_notes_dir, "note-2024_test.md")
        assert retrieved == content


class TestConcurrentOperations:
    """Test concurrent file operations (basic tests)"""

    def test_multiple_saves_to_different_notes(self, temp_notes_dir):
        """Test saving multiple notes doesn't interfere"""
        result1 = save_note(temp_notes_dir, "note1.md", "Content 1")
        result2 = save_note(temp_notes_dir, "note2.md", "Content 2")
        result3 = save_note(temp_notes_dir, "note3.md", "Content 3")

        assert all([result1, result2, result3])

        assert get_note_content(temp_notes_dir, "note1.md") == "Content 1"
        assert get_note_content(temp_notes_dir, "note2.md") == "Content 2"
        assert get_note_content(temp_notes_dir, "note3.md") == "Content 3"

    def test_create_multiple_folders(self, temp_notes_dir):
        """Test creating multiple folders"""
        result1 = create_folder(temp_notes_dir, "folder1")
        result2 = create_folder(temp_notes_dir, "folder2")
        result3 = create_folder(temp_notes_dir, "folder3")

        assert all([result1, result2, result3])


class TestDataIntegrity:
    """Test data integrity edge cases"""

    def test_large_note_content(self, temp_notes_dir):
        """Test saving and reading large notes"""
        large_content = "# Large Note\n" + ("Content line\n" * 50000)
        result = save_note(temp_notes_dir, "large.md", large_content)
        assert result is True

        retrieved = get_note_content(temp_notes_dir, "large.md")
        assert retrieved == large_content

    def test_note_with_special_markdown(self, temp_notes_dir):
        """Test notes with special markdown content"""
        content = """# Test Note

```python
def hello():
    print("world")
```

| Table | Header |
|-------|--------|
| Cell  | Data   |

> Quote

- List item
"""
        result = save_note(temp_notes_dir, "markdown.md", content)
        assert result is True

        retrieved = get_note_content(temp_notes_dir, "markdown.md")
        assert retrieved == content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
