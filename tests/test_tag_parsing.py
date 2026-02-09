"""Tests for tag parsing in backend/services/tag_service.py"""

import importlib.util
from pathlib import Path

import pytest

# Load tag_service directly from file to avoid circular import through backend.services.__init__
_tag_service_path = Path(__file__).resolve().parent.parent / "backend" / "services" / "tag_service.py"
_spec = importlib.util.spec_from_file_location("tag_service", _tag_service_path)
_tag_service = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tag_service)
_normalize_tags = _tag_service._normalize_tags
parse_tags = _tag_service.parse_tags


class TestNormalizeTags:
    """Tests for the _normalize_tags helper function."""

    def test_space_separated(self):
        assert _normalize_tags("meta vault") == ["meta", "vault"]

    def test_comma_separated(self):
        assert _normalize_tags("meta, vault") == ["meta", "vault"]

    def test_hash_prefixed_space_separated(self):
        assert _normalize_tags("#meta #vault") == ["meta", "vault"]

    def test_hash_prefixed_comma_separated(self):
        assert _normalize_tags("#meta, #vault") == ["meta", "vault"]

    def test_hierarchical_tag(self):
        result = _normalize_tags("#meta/vault")
        assert "meta/vault" in result
        assert "meta" in result
        assert "vault" in result

    def test_list_input(self):
        assert _normalize_tags(["#meta", "vault"]) == ["meta", "vault"]

    def test_list_with_hierarchical(self):
        result = _normalize_tags(["#parent/child", "other"])
        assert "parent/child" in result
        assert "parent" in result
        assert "child" in result
        assert "other" in result

    def test_empty_string(self):
        assert _normalize_tags("") == []

    def test_empty_list(self):
        assert _normalize_tags([]) == []

    def test_deduplication(self):
        assert _normalize_tags("meta, meta") == ["meta"]

    def test_case_insensitive(self):
        assert _normalize_tags("Meta, VAULT") == ["meta", "vault"]

    def test_single_tag(self):
        assert _normalize_tags("python") == ["python"]

    def test_hash_only(self):
        assert _normalize_tags("#") == []

    def test_mixed_hash_and_plain(self):
        assert _normalize_tags("#meta, vault") == ["meta", "vault"]


class TestParseTags:
    """Tests for parse_tags with various frontmatter formats."""

    def test_inline_array(self):
        content = "---\ntags: [python, tutorial, backend]\n---\nContent"
        assert parse_tags(content) == ["backend", "python", "tutorial"]

    def test_inline_array_with_hash(self):
        content = "---\ntags: [#python, #tutorial]\n---\nContent"
        assert parse_tags(content) == ["python", "tutorial"]

    def test_yaml_list(self):
        content = "---\ntags:\n  - python\n  - tutorial\n---\nContent"
        assert parse_tags(content) == ["python", "tutorial"]

    def test_yaml_list_with_hash(self):
        content = "---\ntags:\n  - #python\n  - #tutorial\n---\nContent"
        assert parse_tags(content) == ["python", "tutorial"]

    def test_space_separated(self):
        content = "---\ntags: meta vault\n---\nContent"
        assert parse_tags(content) == ["meta", "vault"]

    def test_comma_separated(self):
        content = "---\ntags: meta, vault\n---\nContent"
        assert parse_tags(content) == ["meta", "vault"]

    def test_hash_space_separated(self):
        content = "---\ntags: #meta #vault\n---\nContent"
        assert parse_tags(content) == ["meta", "vault"]

    def test_hash_comma_separated(self):
        content = "---\ntags: #meta, #vault\n---\nContent"
        assert parse_tags(content) == ["meta", "vault"]

    def test_hierarchical(self):
        content = "---\ntags: #meta/vault\n---\nContent"
        result = parse_tags(content)
        assert "meta/vault" in result
        assert "meta" in result
        assert "vault" in result

    def test_hierarchical_in_yaml_list(self):
        content = "---\ntags:\n  - #parent/child\n  - other\n---\nContent"
        result = parse_tags(content)
        assert "parent/child" in result
        assert "parent" in result
        assert "child" in result
        assert "other" in result

    def test_no_frontmatter(self):
        assert parse_tags("No frontmatter here") == []

    def test_no_tags_field(self):
        content = "---\ntitle: Test\n---\nContent"
        assert parse_tags(content) == []

    def test_empty_tags(self):
        content = "---\ntags:\n---\nContent"
        assert parse_tags(content) == []

    def test_single_tag_inline(self):
        content = "---\ntags: python\n---\nContent"
        assert parse_tags(content) == ["python"]

    def test_single_hash_tag_inline(self):
        content = "---\ntags: #python\n---\nContent"
        assert parse_tags(content) == ["python"]

    def test_empty_content(self):
        assert parse_tags("") == []

    def test_unclosed_frontmatter(self):
        content = "---\ntags: python\nNo closing delimiter"
        assert parse_tags(content) == []
