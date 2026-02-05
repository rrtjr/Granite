"""
Backend tests for Draw.io Cache System

Tests the draw.io SVG caching API endpoints for storing, retrieving,
and managing diagram previews.

Run with: pytest tests/test_drawio.py
"""

import hashlib
import shutil
import sys
import tempfile
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path to allow backend imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from backend.routers.drawio import hash_xml


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def temp_cache_dir(monkeypatch):
    """Create a temporary cache directory for testing"""
    temp_dir = tempfile.mkdtemp()
    cache_path = Path(temp_dir) / ".drawio-cache"
    cache_path.mkdir(parents=True)

    # Monkeypatch the get_cache_dir function to return our temp dir
    monkeypatch.setattr("backend.routers.drawio.get_cache_dir", lambda: cache_path)

    yield cache_path

    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.fixture
def sample_xml():
    """Sample Draw.io XML content"""
    return """<mxGraphModel dx="1234" dy="789" grid="1" gridSize="10">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="Test Box" style="rounded=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>"""


@pytest.fixture
def sample_svg():
    """Sample SVG content"""
    return """<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect x="10" y="10" width="120" height="60" rx="5" fill="#ffffff" stroke="#000000"/>
  <text x="70" y="45" text-anchor="middle">Test Box</text>
</svg>"""


class TestHashXml:
    """Test XML hashing function"""

    def test_hash_xml_returns_16_chars(self, sample_xml):
        """Test that hash_xml returns a 16-character hex string"""
        result = hash_xml(sample_xml)

        assert len(result) == 16
        assert all(c in "0123456789abcdef" for c in result)

    def test_hash_xml_consistent(self, sample_xml):
        """Test that same XML produces same hash"""
        hash1 = hash_xml(sample_xml)
        hash2 = hash_xml(sample_xml)

        assert hash1 == hash2

    def test_hash_xml_different_for_different_content(self, sample_xml):
        """Test that different XML produces different hash"""
        hash1 = hash_xml(sample_xml)
        hash2 = hash_xml(sample_xml + " modified")

        assert hash1 != hash2

    def test_hash_xml_uses_sha256(self, sample_xml):
        """Test that hash is first 16 chars of SHA-256"""
        expected = hashlib.sha256(sample_xml.encode("utf-8")).hexdigest()[:16]
        result = hash_xml(sample_xml)

        assert result == expected


class TestSaveCache:
    """Test POST /api/drawio-cache endpoint"""

    def test_save_cache_success(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test successfully saving SVG to cache"""
        response = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": sample_svg},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "hash" in data
        assert len(data["hash"]) == 16

        # Verify file was created
        cache_file = temp_cache_dir / f"{data['hash']}.svg"
        assert cache_file.exists()
        assert cache_file.read_text(encoding="utf-8") == sample_svg

    def test_save_cache_missing_xml(self, client, temp_cache_dir):
        """Test that saving without XML fails"""
        response = client.post(
            "/api/drawio-cache",
            json={"xml": "", "svg": "<svg></svg>"},
        )

        assert response.status_code == 400

    def test_save_cache_missing_svg(self, client, temp_cache_dir, sample_xml):
        """Test that saving without SVG fails"""
        response = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": ""},
        )

        assert response.status_code == 400

    def test_save_cache_overwrites_existing(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test that saving same XML overwrites existing cache"""
        # Save first version
        response1 = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": sample_svg},
        )
        hash1 = response1.json()["hash"]

        # Save updated version with same XML
        new_svg = "<svg><text>Updated</text></svg>"
        response2 = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": new_svg},
        )
        hash2 = response2.json()["hash"]

        # Same hash since same XML
        assert hash1 == hash2

        # File should contain new content
        cache_file = temp_cache_dir / f"{hash1}.svg"
        assert cache_file.read_text(encoding="utf-8") == new_svg


class TestGetCache:
    """Test GET /api/drawio-cache/{hash} endpoint"""

    def test_get_cache_success(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test successfully retrieving cached SVG"""
        # Save first
        save_response = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": sample_svg},
        )
        cache_hash = save_response.json()["hash"]

        # Retrieve
        response = client.get(f"/api/drawio-cache/{cache_hash}")

        assert response.status_code == 200
        assert "image/svg+xml" in response.headers["content-type"]
        assert response.text == sample_svg

    def test_get_cache_not_found(self, client, temp_cache_dir):
        """Test that getting non-existent cache returns 404"""
        response = client.get("/api/drawio-cache/1234567890abcdef")

        assert response.status_code == 404

    def test_get_cache_invalid_hash_format(self, client, temp_cache_dir):
        """Test that invalid hash format returns 400"""
        # Too short
        response = client.get("/api/drawio-cache/abc123")
        assert response.status_code == 400

        # Too long
        response = client.get("/api/drawio-cache/1234567890abcdef1234")
        assert response.status_code == 400

        # Invalid characters
        response = client.get("/api/drawio-cache/ghijklmnopqrstuv")
        assert response.status_code == 400


class TestDeleteCache:
    """Test DELETE /api/drawio-cache/{hash} endpoint"""

    def test_delete_cache_success(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test successfully deleting cached SVG"""
        # Save first
        save_response = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": sample_svg},
        )
        cache_hash = save_response.json()["hash"]

        # Verify file exists
        cache_file = temp_cache_dir / f"{cache_hash}.svg"
        assert cache_file.exists()

        # Delete
        response = client.delete(f"/api/drawio-cache/{cache_hash}")

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify file deleted
        assert not cache_file.exists()

    def test_delete_cache_not_found_still_succeeds(self, client, temp_cache_dir):
        """Test that deleting non-existent cache still returns success"""
        response = client.delete("/api/drawio-cache/1234567890abcdef")

        # Should succeed even if file doesn't exist
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestGetCacheStats:
    """Test GET /api/drawio-cache endpoint (stats)"""

    def test_get_stats_empty_cache(self, client, temp_cache_dir):
        """Test getting stats with empty cache"""
        response = client.get("/api/drawio-cache")

        assert response.status_code == 200
        data = response.json()

        assert data["file_count"] == 0
        assert data["total_size_bytes"] == 0
        assert data["total_size_mb"] == 0.0
        assert data["oldest_file_age_days"] is None

    def test_get_stats_with_files(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test getting stats with cached files"""
        # Save some files
        for i in range(3):
            xml = f"{sample_xml}<!-- {i} -->"
            client.post(
                "/api/drawio-cache",
                json={"xml": xml, "svg": sample_svg},
            )

        response = client.get("/api/drawio-cache")

        assert response.status_code == 200
        data = response.json()

        assert data["file_count"] == 3
        assert data["total_size_bytes"] > 0
        assert "total_size_mb" in data
        assert data["oldest_file_age_days"] is not None


class TestCleanupCache:
    """Test POST /api/drawio-cache/cleanup endpoint"""

    def test_cleanup_removes_old_files(self, client, temp_cache_dir):
        """Test that cleanup removes files older than threshold"""
        # Create some "old" files by modifying their mtime
        old_time = time.time() - (40 * 24 * 60 * 60)  # 40 days ago

        old_file = temp_cache_dir / "oldfile123456ab.svg"
        old_file.write_text("<svg>old</svg>")
        import os

        os.utime(old_file, (old_time, old_time))

        new_file = temp_cache_dir / "newfile123456ab.svg"
        new_file.write_text("<svg>new</svg>")

        # Cleanup with 30 day threshold
        response = client.post("/api/drawio-cache/cleanup?max_age_days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["deleted_count"] == 1

        # Old file should be gone, new file should remain
        assert not old_file.exists()
        assert new_file.exists()

    def test_cleanup_respects_max_age(self, client, temp_cache_dir):
        """Test that cleanup respects max_age_days parameter"""
        # Create files
        file1 = temp_cache_dir / "file1234567890ab.svg"
        file1.write_text("<svg>test</svg>")

        # With very high max_age, nothing should be deleted
        response = client.post("/api/drawio-cache/cleanup?max_age_days=365")

        assert response.status_code == 200
        assert response.json()["deleted_count"] == 0
        assert file1.exists()

    def test_cleanup_invalid_max_age(self, client, temp_cache_dir):
        """Test that invalid max_age_days returns error"""
        # Too low
        response = client.post("/api/drawio-cache/cleanup?max_age_days=0")
        assert response.status_code == 422

        # Too high
        response = client.post("/api/drawio-cache/cleanup?max_age_days=1000")
        assert response.status_code == 422


class TestClearAllCache:
    """Test DELETE /api/drawio-cache endpoint (clear all)"""

    def test_clear_all_removes_all_files(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test that clear all removes all cached files"""
        # Save some files
        for i in range(5):
            xml = f"{sample_xml}<!-- {i} -->"
            client.post(
                "/api/drawio-cache",
                json={"xml": xml, "svg": sample_svg},
            )

        # Verify files exist
        files = list(temp_cache_dir.glob("*.svg"))
        assert len(files) == 5

        # Clear all
        response = client.delete("/api/drawio-cache")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["deleted_count"] == 5

        # Verify all files deleted
        files = list(temp_cache_dir.glob("*.svg"))
        assert len(files) == 0

    def test_clear_all_empty_cache(self, client, temp_cache_dir):
        """Test clearing an already empty cache"""
        response = client.delete("/api/drawio-cache")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["deleted_count"] == 0


class TestCacheIntegration:
    """Integration tests for the cache system"""

    def test_full_cache_workflow(self, client, temp_cache_dir, sample_xml, sample_svg):
        """Test complete cache workflow: save, get, stats, delete"""
        # 1. Save
        save_response = client.post(
            "/api/drawio-cache",
            json={"xml": sample_xml, "svg": sample_svg},
        )
        assert save_response.status_code == 200
        cache_hash = save_response.json()["hash"]

        # 2. Get stats - should show 1 file
        stats_response = client.get("/api/drawio-cache")
        assert stats_response.json()["file_count"] == 1

        # 3. Retrieve
        get_response = client.get(f"/api/drawio-cache/{cache_hash}")
        assert get_response.status_code == 200
        assert get_response.text == sample_svg

        # 4. Delete specific
        delete_response = client.delete(f"/api/drawio-cache/{cache_hash}")
        assert delete_response.status_code == 200

        # 5. Verify deleted
        get_response2 = client.get(f"/api/drawio-cache/{cache_hash}")
        assert get_response2.status_code == 404

        # 6. Stats should show 0 files
        stats_response2 = client.get("/api/drawio-cache")
        assert stats_response2.json()["file_count"] == 0

    def test_multiple_diagrams_independent(self, client, temp_cache_dir, sample_svg):
        """Test that multiple diagrams have independent caches"""
        xml1 = "<mxGraphModel><root>Diagram 1</root></mxGraphModel>"
        xml2 = "<mxGraphModel><root>Diagram 2</root></mxGraphModel>"
        svg1 = "<svg><text>SVG 1</text></svg>"
        svg2 = "<svg><text>SVG 2</text></svg>"

        # Save both
        response1 = client.post(
            "/api/drawio-cache",
            json={"xml": xml1, "svg": svg1},
        )
        response2 = client.post(
            "/api/drawio-cache",
            json={"xml": xml2, "svg": svg2},
        )

        hash1 = response1.json()["hash"]
        hash2 = response2.json()["hash"]

        # Different hashes
        assert hash1 != hash2

        # Retrieve each and verify correct content
        get1 = client.get(f"/api/drawio-cache/{hash1}")
        get2 = client.get(f"/api/drawio-cache/{hash2}")

        assert get1.text == svg1
        assert get2.text == svg2

        # Delete one, other should remain
        client.delete(f"/api/drawio-cache/{hash1}")

        assert client.get(f"/api/drawio-cache/{hash1}").status_code == 404
        assert client.get(f"/api/drawio-cache/{hash2}").status_code == 200
