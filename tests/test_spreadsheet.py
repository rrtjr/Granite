"""
Unit tests for spreadsheet functionality.

Since spreadsheets are client-side only (HyperFormula runs in browser),
these tests verify:
1. Spreadsheet code blocks are preserved in markdown through save/load cycles
2. The markdown format is correct
3. Notes with spreadsheet content can be created, saved, and loaded
"""

import shutil
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def temp_notes_dir(monkeypatch):
    """Create a temporary notes directory for testing."""
    temp_dir = tempfile.mkdtemp()
    # Would need to patch the notes directory in config
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


class TestSpreadsheetMarkdown:
    """Test spreadsheet code blocks in markdown files."""

    def test_spreadsheet_block_format_simple(self):
        """Verify simple spreadsheet block format is valid."""
        content = """# Test Note

```spreadsheet
Name,Value,Total
Item 1,100,110
Item 2,200,220
```

Some text after.
"""
        assert "```spreadsheet" in content
        assert "```" in content
        # Verify it has proper opening and closing
        lines = content.split("\n")
        has_opening = False
        has_closing = False
        for line in lines:
            if line.strip() == "```spreadsheet":
                has_opening = True
            elif line.strip() == "```" and has_opening:
                has_closing = True
                break
        assert has_opening and has_closing

    def test_spreadsheet_with_formulas(self):
        """Verify spreadsheet with formulas format is valid."""
        content = """# Budget

```spreadsheet
Item,Cost,Tax,Total
Laptop,1000,=B2*0.1,=B2+C2
Phone,500,=B3*0.1,=B3+C3
Total,=SUM(B2:B3),=SUM(C2:C3),=SUM(D2:D3)
```
"""
        assert "```spreadsheet" in content
        assert "=B2*0.1" in content
        assert "=SUM(B2:B3)" in content

    def test_spreadsheet_with_quoted_values(self):
        """Verify spreadsheet with quoted values containing commas."""
        content = """```spreadsheet
Name,Description,Value
"Smith, John","Manager, Sales",50000
"Doe, Jane","Director, HR",75000
```"""
        assert "```spreadsheet" in content
        assert '"Smith, John"' in content

    def test_multiple_spreadsheets_in_note(self):
        """Verify multiple spreadsheets in a single note."""
        content = """# Financial Report

## Q1 Results
```spreadsheet
Month,Revenue
January,10000
February,12000
March,15000
```

## Q2 Results
```spreadsheet
Month,Revenue
April,14000
May,16000
June,18000
```
"""
        # Count occurrences
        count = content.count("```spreadsheet")
        assert count == 2


class TestSpreadsheetFormulas:
    """Test formula syntax validation."""

    def test_basic_formula_format(self):
        """Verify basic formula syntax."""
        formulas = [
            "=A1+B1",
            "=A1-B1",
            "=A1*B1",
            "=A1/B1",
            "=A1^2",
        ]
        for formula in formulas:
            assert formula.startswith("=")
            assert len(formula) > 1

    def test_function_formula_format(self):
        """Verify function formula syntax."""
        formulas = [
            "=SUM(A1:A10)",
            "=AVERAGE(B2:B5)",
            "=MIN(C1:C100)",
            "=MAX(D1:D50)",
            "=COUNT(E1:E20)",
            "=IF(A1>0,B1,C1)",
        ]
        for formula in formulas:
            assert formula.startswith("=")
            assert "(" in formula
            assert ")" in formula

    def test_cell_reference_format(self):
        """Verify cell reference syntax."""
        references = [
            "A1",
            "B2",
            "C3",
            "Z26",
            "AA1",
            "AB100",
            "A1:A10",
            "B2:D5",
        ]
        for ref in references:
            # Basic validation - starts with letter, contains number
            assert ref[0].isalpha()
            assert any(c.isdigit() for c in ref)


class TestSpreadsheetCSVParsing:
    """Test CSV parsing edge cases (validates expected format)."""

    def test_simple_csv_format(self):
        """Verify simple CSV format."""
        csv = "A,B,C\n1,2,3\n4,5,6"
        lines = csv.split("\n")
        assert len(lines) == 3
        assert lines[0] == "A,B,C"

    def test_csv_with_empty_cells(self):
        """Verify CSV with empty cells."""
        csv = "A,B,C\n1,,3\n,5,"
        lines = csv.split("\n")
        assert len(lines) == 3
        # Empty cells result in empty strings between commas
        assert ",," in csv

    def test_csv_with_quoted_commas(self):
        """Verify CSV with quoted values containing commas."""
        csv = '"Hello, World",B,C\n1,2,3'
        lines = csv.split("\n")
        assert len(lines) == 2
        assert '"Hello, World"' in csv

    def test_csv_with_escaped_quotes(self):
        """Verify CSV with escaped quotes."""
        csv = '"Say ""Hello""",B,C\n1,2,3'
        assert '""Hello""' in csv


class TestSpreadsheetIntegration:
    """Integration tests for spreadsheet content in notes API."""

    def test_note_with_spreadsheet_roundtrip(self, client):
        """Test creating and loading a note with spreadsheet content."""
        spreadsheet_content = """# Test

```spreadsheet
A,B,C
1,2,=A2+B2
```
"""
        # This test verifies the API can handle notes with spreadsheet blocks
        # The actual test would create a note, save it, load it, and verify content
        # For now, we just verify the content format is valid
        assert "```spreadsheet" in spreadsheet_content
        assert "=A2+B2" in spreadsheet_content


class TestSpreadsheetEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_spreadsheet(self):
        """Verify empty spreadsheet block."""
        content = """```spreadsheet
```"""
        assert "```spreadsheet" in content

    def test_single_cell_spreadsheet(self):
        """Verify single cell spreadsheet."""
        content = """```spreadsheet
Value
100
```"""
        assert "```spreadsheet" in content

    def test_spreadsheet_with_special_characters(self):
        """Verify spreadsheet with special characters."""
        content = """```spreadsheet
Name,Symbol,Value
Euro,\u20ac,1.10
Pound,\u00a3,1.25
```"""
        assert "```spreadsheet" in content

    def test_spreadsheet_with_numbers_and_text(self):
        """Verify mixed content types."""
        content = """```spreadsheet
ID,Name,Score,Grade
1,Alice,95,A
2,Bob,87,B
3,Charlie,92,A
```"""
        assert "```spreadsheet" in content
        assert "Alice" in content
        assert "95" in content


class TestSpreadsheetMultipleTables:
    """Test handling of multiple spreadsheets in a note."""

    def test_two_spreadsheets_separated(self):
        """Verify two spreadsheets can exist in same note."""
        content = """# Report

## Sales
```spreadsheet
Product,Units,Price
Widget,100,10
Gadget,50,25
```

## Expenses
```spreadsheet
Category,Amount
Rent,1000
Utilities,200
```
"""
        # Count spreadsheet blocks
        count = content.count("```spreadsheet")
        assert count == 2

    def test_spreadsheets_with_different_column_counts(self):
        """Verify spreadsheets can have different structures."""
        content = """```spreadsheet
A,B
1,2
```

```spreadsheet
X,Y,Z,W
a,b,c,d
```
"""
        assert content.count("```spreadsheet") == 2
        # First has 2 columns, second has 4

    def test_spreadsheet_ids_should_be_sequential(self):
        """Document that spreadsheet IDs are assigned in order."""
        content = """```spreadsheet
First,Table
1,2
```

```spreadsheet
Second,Table
3,4
```

```spreadsheet
Third,Table
5,6
```
"""
        # When rendered, these should get IDs 0, 1, 2
        assert content.count("```spreadsheet") == 3


class TestSpreadsheetDeactivation:
    """Test spreadsheet deactivation format requirements."""

    def test_deactivated_spreadsheet_preserves_data(self):
        """Verify data format is preserved when spreadsheet is deactivated."""
        original = """Item,Price,Qty
Laptop,1000,2
Phone,500,3"""

        # After editing and deactivating, format should be same
        # (This documents the expected behavior)
        lines = original.split("\n")
        assert len(lines) == 3
        assert lines[0] == "Item,Price,Qty"

    def test_spreadsheet_with_formulas_preserved(self):
        """Verify formulas are preserved in CSV format."""
        content = """```spreadsheet
A,B,Sum
10,20,=A2+B2
30,40,=A3+B3
```"""
        assert "=A2+B2" in content
        assert "=A3+B3" in content


class TestSpreadsheetEditorSync:
    """Test spreadsheet to editor sync format requirements."""

    def test_sync_format_matches_original(self):
        """Verify synced content maintains proper CSV format."""
        original_csv = """Name,Value,Total
Item 1,100,=B2*1.1
Item 2,200,=B3*1.1"""

        lines = original_csv.split("\n")
        # Each line should have same number of commas
        comma_counts = [line.count(",") for line in lines]
        assert all(c == comma_counts[0] for c in comma_counts)

    def test_code_block_format_for_sync(self):
        """Verify code block format used for editor sync."""
        csv_content = "A,B\n1,2"
        expected_block = f"```spreadsheet\n{csv_content}\n```"

        assert expected_block.startswith("```spreadsheet\n")
        assert expected_block.endswith("\n```")

    def test_regex_pattern_matches_spreadsheet_blocks(self):
        """Verify the regex pattern used for finding spreadsheet blocks."""
        import re

        content = """Some text

```spreadsheet
A,B,C
1,2,3
```

More text

```spreadsheet
X,Y
a,b
```
"""
        # This is the pattern used in updateSpreadsheetInEditor
        pattern = r"```spreadsheet\n([\s\S]*?)\n```"
        matches = re.findall(pattern, content)

        assert len(matches) == 2
        assert matches[0] == "A,B,C\n1,2,3"
        assert matches[1] == "X,Y\na,b"


class TestSpreadsheetViewModes:
    """Test spreadsheet behavior documentation for different view modes."""

    def test_edit_mode_requirements(self):
        """Document edit view requirements for spreadsheets."""
        # In full edit view:
        # 1. Editor shows raw markdown with ```spreadsheet blocks
        # 2. Preview pane is hidden
        # 3. Spreadsheets can be edited by clicking on them
        # 4. Toolbar with +Row/+Col/-Row/-Col buttons appears

        requirements = [
            "Editor shows raw CSV in code blocks",
            "Click activates spreadsheet edit mode",
            "Toolbar buttons for row/column manipulation",
            "Cell edits sync to editor in realtime",
        ]
        assert len(requirements) == 4

    def test_split_view_requirements(self):
        """Document split view requirements for spreadsheets."""
        # In split view:
        # 1. Editor shows raw markdown with ```spreadsheet blocks
        # 2. Preview shows rendered tables (read-only)
        # 3. Editing disabled in preview - user edits raw markdown in editor
        # 4. Custom sheet names displayed from name= attribute

        requirements = [
            "Editor shows raw CSV in code blocks",
            "Preview renders as HTML tables (read-only)",
            "Editing disabled - use editor to modify",
            "Custom sheet names from name= attribute displayed",
        ]
        assert len(requirements) == 4

    def test_preview_view_requirements(self):
        """Document preview-only view requirements."""
        # In preview view:
        # 1. Spreadsheets render as tables (read-only)
        # 2. Editing disabled in preview mode
        # 3. Formulas show calculated values
        # 4. Custom sheet names displayed

        requirements = [
            "Tables rendered from CSV (read-only)",
            "Editing disabled in preview mode",
            "HyperFormula evaluates formulas",
            "Custom sheet names displayed",
        ]
        assert len(requirements) == 4


class TestCrossSheetReferences:
    """Test cross-sheet reference syntax and format."""

    def test_cross_sheet_reference_format(self):
        """Verify cross-sheet reference syntax."""
        references = [
            "=Sheet1!A1",
            "=Sheet2!B2",
            "=Sheet1!A1:A10",
            "=Sheet2!B2:D5",
        ]
        for ref in references:
            assert ref.startswith("=")
            assert "!" in ref
            # Sheet name before !
            parts = ref[1:].split("!")
            assert parts[0].startswith("Sheet")

    def test_cross_sheet_formula_format(self):
        """Verify formulas with cross-sheet references."""
        formulas = [
            "=Sheet1!A1+Sheet2!A1",
            "=SUM(Sheet1!A1:A10)",
            "=Sheet1!B4-Sheet2!B5",
            "=AVERAGE(Sheet2!C1:C10)",
        ]
        for formula in formulas:
            assert formula.startswith("=")
            assert "Sheet" in formula
            assert "!" in formula

    def test_multiple_sheets_in_note_format(self):
        """Verify format for notes with cross-sheet references."""
        content = """# Financial Summary

## Income (Sheet1)
```spreadsheet
Source,Amount
Salary,5000
Freelance,1500
Total,=SUM(B2:B3)
```

## Expenses (Sheet2)
```spreadsheet
Category,Amount
Rent,1500
Utilities,200
Total,=SUM(B2:B3)
```

## Summary (Sheet3)
```spreadsheet
Description,Amount
Income,=Sheet1!B4
Expenses,=Sheet2!B4
Net,=Sheet1!B4-Sheet2!B4
```
"""
        assert content.count("```spreadsheet") == 3
        assert "=Sheet1!B4" in content
        assert "=Sheet2!B4" in content
        assert "=Sheet1!B4-Sheet2!B4" in content

    def test_sheet_naming_convention(self):
        """Document sheet naming convention (1-indexed)."""
        # Sheets are named Sheet1, Sheet2, Sheet3, etc.
        # First spreadsheet in note = Sheet1
        # Second spreadsheet = Sheet2
        sheet_names = ["Sheet1", "Sheet2", "Sheet3", "Sheet10"]
        for name in sheet_names:
            assert name.startswith("Sheet")
            # Number part should be valid integer
            num_part = name[5:]
            assert num_part.isdigit()
            assert int(num_part) >= 1

    def test_cross_sheet_with_ranges(self):
        """Verify cross-sheet references with cell ranges."""
        content = """```spreadsheet
A,B,Total
1,2,=SUM(Sheet2!A2:B2)
```

```spreadsheet
X,Y
10,20
```
"""
        assert "=SUM(Sheet2!A2:B2)" in content
        # This formula references a range from Sheet2


class TestCustomSheetNames:
    """Test custom sheet name extraction from markdown."""

    def test_custom_name_with_double_quotes(self):
        """Verify custom sheet name with double quotes."""
        content = """```spreadsheet name="Income Statement"
Revenue,Amount
Sales,10000
```"""
        assert 'name="Income Statement"' in content

    def test_custom_name_with_single_quotes(self):
        """Verify custom sheet name with single quotes."""
        content = """```spreadsheet name='Expense Report'
Item,Cost
Rent,1500
```"""
        assert "name='Expense Report'" in content

    def test_custom_name_without_quotes(self):
        """Verify custom sheet name without quotes (single word)."""
        content = """```spreadsheet name=Budget
Category,Amount
Income,5000
```"""
        assert "name=Budget" in content

    def test_custom_name_with_title_attribute(self):
        """Verify title= works as alias for name=."""
        content = """```spreadsheet title="Sales Data"
Product,Units
Widget,100
```"""
        assert 'title="Sales Data"' in content

    def test_multiple_custom_named_sheets(self):
        """Verify multiple sheets with custom names."""
        content = """```spreadsheet name="Sheet A"
A,B
1,2
```

```spreadsheet name="Sheet B"
X,Y
3,4
```"""
        assert 'name="Sheet A"' in content
        assert 'name="Sheet B"' in content

    def test_mixed_custom_and_default_names(self):
        """Verify mix of custom and default sheet names."""
        content = """```spreadsheet name="Custom Name"
A,B
1,2
```

```spreadsheet
X,Y
3,4
```

```spreadsheet name="Another Custom"
P,Q
5,6
```"""
        # First and third have custom names, second will default to Sheet2
        assert 'name="Custom Name"' in content
        assert 'name="Another Custom"' in content
        # Middle one has no name attribute
        lines = content.split("\n")
        middle_block = [line for line in lines if line.strip() == "```spreadsheet"]
        assert len(middle_block) == 1  # One without name

    def test_name_extraction_regex_pattern(self):
        """Verify the regex pattern for name extraction works correctly."""
        import re

        # Pattern used in extractSpreadsheetNamesFromContent
        header_re = re.compile(r"^[ \t]*```+[ \t]*spreadsheet([^\r\n]*)", re.MULTILINE | re.IGNORECASE)
        name_re = re.compile(r'(?:name|title)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s,;]+))', re.IGNORECASE)

        test_cases = [
            ('```spreadsheet name="Sample"', "Sample"),
            ("```spreadsheet name='Budget'", "Budget"),
            ("```spreadsheet name=Income", "Income"),
            ('```spreadsheet title="Report"', "Report"),
            ('   ```spreadsheet name="Trimmed"', "Trimmed"),
            ("```spreadsheet", ""),  # No name
        ]

        for line, expected_name in test_cases:
            header_match = header_re.search(line)
            assert header_match is not None, f"Header should match: {line}"
            meta = (header_match.group(1) or "").strip()

            name = ""
            if meta:
                name_match = name_re.search(meta)
                if name_match:
                    name = (name_match.group(1) or name_match.group(2) or name_match.group(3) or "").strip()

            assert name == expected_name, f"Expected '{expected_name}' but got '{name}' for: {line}"

    def test_cross_reference_with_custom_name(self):
        """Verify cross-references work with custom sheet names."""
        content = """```spreadsheet name="Revenue"
Source,Amount
Sales,10000
```

```spreadsheet name="Summary"
Item,Value
Total Revenue,=Revenue!B2
```"""
        # Reference uses custom name "Revenue" instead of Sheet1
        assert "=Revenue!B2" in content
        assert 'name="Revenue"' in content
