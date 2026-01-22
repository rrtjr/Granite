"""
Graph Folder Wiki Links Tests

Tests for folder support in the knowledge graph and wiki link detection:
- Folders appear as nodes in the graph
- Wiki links to folders are detected
- Folder matching works with different formats (exact path, name only, case-insensitive)
- Markdown links to folders are detected

Run with: pytest tests/test_graph_folder_links.py -v
"""

import sys
import tempfile
from pathlib import Path

import pytest

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.utils import (
    create_folder,
    get_all_folders,
    get_all_notes,
    get_note_content,
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
def notes_dir_with_folders_and_links(temp_notes_dir):
    """Create notes directory with folders and notes containing wiki links to folders"""
    # Create folders
    create_folder(temp_notes_dir, "Projects")
    create_folder(temp_notes_dir, "Projects/Active")
    create_folder(temp_notes_dir, "Archive")
    create_folder(temp_notes_dir, "0_Inbox")

    # Create notes with wiki links to folders
    save_note(
        temp_notes_dir,
        "index.md",
        "# Index\n\nCheck out my [[Projects]] folder and [[0_Inbox]].",
    )
    save_note(
        temp_notes_dir,
        "navigation.md",
        "# Navigation\n\nGo to [[Projects/Active]] or [[Archive|Old Stuff]].",
    )
    save_note(
        temp_notes_dir,
        "case_test.md",
        "# Case Test\n\nLinks: [[projects]], [[ARCHIVE]], [[0_inbox]].",
    )
    save_note(
        temp_notes_dir,
        "markdown_links.md",
        "# Markdown Links\n\nSee [my projects](Projects) and [active](Projects/Active).",
    )
    # Note inside a folder linking to sibling folder
    save_note(
        temp_notes_dir,
        "Projects/readme.md",
        "# Projects\n\nSee [[Active]] subfolder or go to [[Archive]].",
    )

    yield temp_notes_dir


class TestFoldersInGraph:
    """Test that folders appear as nodes in the graph"""

    def test_folders_returned_by_get_all_folders(self, notes_dir_with_folders_and_links):
        """Test that get_all_folders returns all created folders"""
        folders = get_all_folders(notes_dir_with_folders_and_links)

        assert "Projects" in folders
        assert "Projects/Active" in folders
        assert "Archive" in folders
        assert "0_Inbox" in folders

    def test_empty_folders_included(self, temp_notes_dir):
        """Test that empty folders are included"""
        create_folder(temp_notes_dir, "EmptyFolder")
        create_folder(temp_notes_dir, "EmptyFolder/Nested")

        folders = get_all_folders(temp_notes_dir)

        assert "EmptyFolder" in folders
        assert "EmptyFolder/Nested" in folders


class TestWikiLinkFolderDetection:
    """Test wiki link detection for folders"""

    def test_build_folder_lookup_structures(self, notes_dir_with_folders_and_links):
        """Test building folder lookup data structures used by graph endpoint"""
        folders = get_all_folders(notes_dir_with_folders_and_links)

        # Build the same structures as the graph endpoint
        folder_paths = set(folders)
        folder_paths_lower = {f.lower(): f for f in folders}
        folder_names = {}
        for folder in folders:
            folder_name = folder.split("/")[-1]
            folder_names[folder_name.lower()] = folder

        # Test exact path matching
        assert "Projects" in folder_paths
        assert "Projects/Active" in folder_paths

        # Test case-insensitive matching
        assert "projects" in folder_paths_lower
        assert folder_paths_lower["projects"] == "Projects"
        assert "archive" in folder_paths_lower

        # Test name-only matching
        assert "active" in folder_names
        assert folder_names["active"] == "Projects/Active"
        assert "inbox" not in folder_names  # Name is "0_Inbox", not "inbox"
        assert "0_inbox" in folder_names

    def test_folder_name_matching_priority(self, temp_notes_dir):
        """Test that when multiple folders have same name, we get a valid match"""
        create_folder(temp_notes_dir, "docs")
        create_folder(temp_notes_dir, "Projects/docs")

        folders = get_all_folders(temp_notes_dir)
        folder_names = {}
        for folder in folders:
            folder_name = folder.split("/")[-1]
            folder_names[folder_name.lower()] = folder

        # Should have one of the "docs" folders (last one wins in current implementation)
        assert "docs" in folder_names
        assert folder_names["docs"] in ["docs", "Projects/docs"]


class TestWikiLinkToFolderParsing:
    """Test parsing wiki links that point to folders"""

    def test_exact_folder_path_in_content(self, notes_dir_with_folders_and_links):
        """Test detecting exact folder path wiki links"""
        import re

        content = get_note_content(notes_dir_with_folders_and_links, "navigation.md")
        wikilinks = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", content)

        assert "Projects/Active" in wikilinks
        assert "Archive" in wikilinks

    def test_folder_name_only_in_content(self, notes_dir_with_folders_and_links):
        """Test detecting folder name-only wiki links"""
        import re

        content = get_note_content(notes_dir_with_folders_and_links, "index.md")
        wikilinks = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", content)

        assert "Projects" in wikilinks
        assert "0_Inbox" in wikilinks

    def test_case_insensitive_folder_links(self, notes_dir_with_folders_and_links):
        """Test detecting case-insensitive folder wiki links"""
        import re

        content = get_note_content(notes_dir_with_folders_and_links, "case_test.md")
        wikilinks = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", content)

        # These should be found (case variations)
        assert "projects" in wikilinks
        assert "ARCHIVE" in wikilinks
        assert "0_inbox" in wikilinks


class TestMarkdownLinkToFolderParsing:
    """Test parsing markdown links that point to folders"""

    def test_markdown_folder_links_detected(self, notes_dir_with_folders_and_links):
        """Test detecting markdown links to folders"""
        import re

        content = get_note_content(notes_dir_with_folders_and_links, "markdown_links.md")
        # Match markdown links: [text](path) excluding external links
        markdown_links = re.findall(r"\[([^\]]+)\]\((?!https?://|mailto:|#|data:)([^\)]+)\)", content)

        paths = [link[1] for link in markdown_links]
        assert "Projects" in paths
        assert "Projects/Active" in paths


class TestFolderLinkResolution:
    """Test the complete folder link resolution logic"""

    def test_resolve_exact_folder_path(self, notes_dir_with_folders_and_links):
        """Test resolving exact folder path"""
        folders = get_all_folders(notes_dir_with_folders_and_links)
        folder_paths = set(folders)
        folder_paths_lower = {f.lower(): f for f in folders}
        folder_names = {}
        for folder in folders:
            folder_name = folder.split("/")[-1]
            folder_names[folder_name.lower()] = folder

        # Simulate resolution logic from graph endpoint
        target = "Projects/Active"
        target_lower = target.lower()

        resolved = None
        if target in folder_paths:
            resolved = target
        elif target_lower in folder_paths_lower:
            resolved = folder_paths_lower[target_lower]
        elif target_lower in folder_names:
            resolved = folder_names[target_lower]

        assert resolved == "Projects/Active"

    def test_resolve_folder_name_only(self, notes_dir_with_folders_and_links):
        """Test resolving folder by name only"""
        folders = get_all_folders(notes_dir_with_folders_and_links)
        folder_paths = set(folders)
        folder_paths_lower = {f.lower(): f for f in folders}
        folder_names = {}
        for folder in folders:
            folder_name = folder.split("/")[-1]
            folder_names[folder_name.lower()] = folder

        # "Active" should resolve to "Projects/Active"
        target = "Active"
        target_lower = target.lower()

        resolved = None
        if target in folder_paths:
            resolved = target
        elif target_lower in folder_paths_lower:
            resolved = folder_paths_lower[target_lower]
        elif target_lower in folder_names:
            resolved = folder_names[target_lower]

        assert resolved == "Projects/Active"

    def test_resolve_case_insensitive(self, notes_dir_with_folders_and_links):
        """Test case-insensitive folder resolution"""
        folders = get_all_folders(notes_dir_with_folders_and_links)
        folder_paths = set(folders)
        folder_paths_lower = {f.lower(): f for f in folders}
        folder_names = {}
        for folder in folders:
            folder_name = folder.split("/")[-1]
            folder_names[folder_name.lower()] = folder

        # "PROJECTS" should resolve to "Projects"
        target = "PROJECTS"
        target_lower = target.lower()

        resolved = None
        if target in folder_paths:
            resolved = target
        elif target_lower in folder_paths_lower:
            resolved = folder_paths_lower[target_lower]
        elif target_lower in folder_names:
            resolved = folder_names[target_lower]

        assert resolved == "Projects"


class TestNotePriorityOverFolder:
    """Test that notes take priority over folders when names conflict"""

    def test_note_takes_priority_over_folder(self, temp_notes_dir):
        """Test that a note with same name as folder is matched first"""
        # Create folder named "Projects"
        create_folder(temp_notes_dir, "Projects")

        # Create note named "Projects.md"
        save_note(temp_notes_dir, "Projects.md", "# Projects Note")

        notes = get_all_notes(temp_notes_dir)
        folders = get_all_folders(temp_notes_dir)

        # Build lookup structures
        note_paths = set()
        note_names = {}
        for note in notes:
            if note.get("type") == "note":
                note_paths.add(note["path"])
                note_paths.add(note["path"].replace(".md", ""))
                name = note["name"].replace(".md", "")
                note_names[name.lower()] = note["path"]

        folder_paths = set(folders)

        # "Projects" should match note first, not folder
        target = "Projects"
        target_lower = target.lower()

        # Check note match first (as in actual implementation)
        note_match = None
        if target in note_paths or target + ".md" in note_paths:
            note_match = target + ".md" if target + ".md" in note_paths else target
        elif target_lower in note_names:
            note_match = note_names[target_lower]

        folder_match = None
        if target in folder_paths:
            folder_match = target

        # Note should be found
        assert note_match is not None
        assert note_match == "Projects.md"
        # Folder also exists
        assert folder_match == "Projects"


class TestGraphEndpointIntegration:
    """Integration tests for the graph endpoint with folders"""

    def test_graph_includes_folder_nodes(self, notes_dir_with_folders_and_links):
        """Test that graph endpoint returns folder nodes"""
        import asyncio

        from backend.config import config

        # Temporarily override config for test
        original_notes_dir = config["storage"]["notes_dir"]
        config["storage"]["notes_dir"] = notes_dir_with_folders_and_links

        try:
            from backend.routers.notes import get_graph

            result = asyncio.run(get_graph())

            # Check that folder nodes exist
            node_ids = [node["id"] for node in result["nodes"]]
            node_types = {node["id"]: node.get("type") for node in result["nodes"]}

            assert "Projects" in node_ids
            assert "Projects/Active" in node_ids
            assert "Archive" in node_ids
            assert "0_Inbox" in node_ids

            # Check types
            assert node_types["Projects"] == "folder"
            assert node_types["Archive"] == "folder"

        finally:
            config["storage"]["notes_dir"] = original_notes_dir

    def test_graph_includes_folder_edges(self, notes_dir_with_folders_and_links):
        """Test that graph endpoint returns edges to folders"""
        import asyncio

        from backend.config import config

        original_notes_dir = config["storage"]["notes_dir"]
        config["storage"]["notes_dir"] = notes_dir_with_folders_and_links

        try:
            from backend.routers.notes import get_graph

            result = asyncio.run(get_graph())

            # Find edges from index.md to folders
            edges_from_index = [edge for edge in result["edges"] if edge["source"] == "index.md"]

            edge_targets = [edge["target"] for edge in edges_from_index]
            edge_types = {edge["target"]: edge["type"] for edge in edges_from_index}

            # index.md has [[Projects]] and [[0_Inbox]]
            assert "Projects" in edge_targets
            assert "0_Inbox" in edge_targets
            assert edge_types["Projects"] == "wikilink-folder"
            assert edge_types["0_Inbox"] == "wikilink-folder"

        finally:
            config["storage"]["notes_dir"] = original_notes_dir

    def test_graph_markdown_folder_edges(self, notes_dir_with_folders_and_links):
        """Test that graph endpoint returns markdown link edges to folders"""
        import asyncio

        from backend.config import config

        original_notes_dir = config["storage"]["notes_dir"]
        config["storage"]["notes_dir"] = notes_dir_with_folders_and_links

        try:
            from backend.routers.notes import get_graph

            result = asyncio.run(get_graph())

            # Find edges from markdown_links.md
            edges_from_md = [edge for edge in result["edges"] if edge["source"] == "markdown_links.md"]

            edge_targets = [edge["target"] for edge in edges_from_md]
            edge_types = {edge["target"]: edge["type"] for edge in edges_from_md}

            # markdown_links.md has [text](Projects) and [text](Projects/Active)
            assert "Projects" in edge_targets
            assert "Projects/Active" in edge_targets
            assert edge_types["Projects"] == "markdown-folder"
            assert edge_types["Projects/Active"] == "markdown-folder"

        finally:
            config["storage"]["notes_dir"] = original_notes_dir

    def test_graph_case_insensitive_folder_edges(self, notes_dir_with_folders_and_links):
        """Test that case-insensitive folder links create edges"""
        import asyncio

        from backend.config import config

        original_notes_dir = config["storage"]["notes_dir"]
        config["storage"]["notes_dir"] = notes_dir_with_folders_and_links

        try:
            from backend.routers.notes import get_graph

            result = asyncio.run(get_graph())

            # Find edges from case_test.md
            edges_from_case = [edge for edge in result["edges"] if edge["source"] == "case_test.md"]

            edge_targets = [edge["target"] for edge in edges_from_case]

            # case_test.md has [[projects]], [[ARCHIVE]], [[0_inbox]]
            # These should resolve to actual folder paths
            assert "Projects" in edge_targets
            assert "Archive" in edge_targets
            assert "0_Inbox" in edge_targets

        finally:
            config["storage"]["notes_dir"] = original_notes_dir


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
