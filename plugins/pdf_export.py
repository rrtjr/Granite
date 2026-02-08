"""
PDF Export Plugin for Granite
Export markdown notes to beautifully formatted PDF files.

Features:
- Convert markdown to styled PDF with proper formatting
- Configurable page settings (size, margins, orientation)
- Support for code syntax highlighting
- Include metadata (title, date, author)
- Custom CSS styling for professional output
- Export single notes or multiple notes
"""

import tempfile
from datetime import datetime, timezone
from pathlib import Path

from markdown import Markdown  # type: ignore[import-untyped]
from weasyprint import CSS, HTML
from weasyprint.text.fonts import FontConfiguration


class Plugin:
    def __init__(self):
        self.name = "PDF Export"
        self.version = "1.0.0"
        self.enabled = True

        # Default settings
        self.settings = {
            # Page settings
            "page_size": "A4",  # A4, Letter, Legal, A5, A3
            "orientation": "portrait",  # portrait or landscape
            "margin_top": "2cm",
            "margin_bottom": "2cm",
            "margin_left": "2cm",
            "margin_right": "2cm",
            # Content settings
            "include_title": True,
            "include_date": True,
            "include_author": False,
            "author_name": "",
            "include_page_numbers": True,
            # Style settings
            "font_family": "serif",  # serif, sans-serif, monospace
            "font_size": "11pt",
            "line_height": "1.6",
            "code_background": "#f5f5f5",
            "table_text_size": "10pt",  # Smaller text in tables
            "heading_color": "#333",
            # Markdown extensions
            "enable_tables": True,
            "enable_code_highlighting": True,
            "enable_toc": False,  # Table of contents
            # Advanced settings
            "break_tables_across_pages": False,  # If true, allows tables to span multiple pages
            "compress_tables": True,  # Use smaller font in tables to fit more content
            # Content stripping settings
            "remove_frontmatter": True,  # Remove YAML frontmatter from exported PDF
            "remove_banner": True,  # Remove banner image reference from exported PDF
            # Mermaid settings
            "render_mermaid": True,  # Render mermaid diagrams as images (pre-rendered by frontend)
        }

    def _get_base_css(self) -> str:
        """Generate base CSS for PDF styling"""
        # Page numbers CSS (bottom right)
        page_numbers_css = ""
        if self.settings["include_page_numbers"]:
            page_numbers_css = """
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #666;
            }
            """

        # Footer info CSS (bottom left) - date and author
        footer_info_parts = []
        if self.settings["include_date"]:
            current_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
            footer_info_parts.append(f"Generated: {current_date}")
        if self.settings["include_author"] and self.settings["author_name"]:
            footer_info_parts.append(f"Author: {self.settings['author_name']}")

        footer_info_css = ""
        if footer_info_parts:
            footer_content = " | ".join(footer_info_parts)
            footer_info_css = f"""
            @bottom-left {{
                content: "{footer_content}";
                font-size: 9pt;
                color: #666;
            }}
            """

        # Table settings
        table_page_break = "avoid" if not self.settings["break_tables_across_pages"] else "auto"
        table_font_size = (
            self.settings["table_text_size"] if self.settings["compress_tables"] else self.settings["font_size"]
        )

        return f"""
        @page {{
            size: {self.settings["page_size"]} {self.settings["orientation"]};
            margin-top: {self.settings["margin_top"]};
            margin-bottom: {self.settings["margin_bottom"]};
            margin-left: {self.settings["margin_left"]};
            margin-right: {self.settings["margin_right"]};
            {page_numbers_css}
            {footer_info_css}
        }}

        body {{
            font-family: {self.settings["font_family"]};
            font-size: {self.settings["font_size"]};
            line-height: {self.settings["line_height"]};
            color: #333;
        }}

        h1 {{
            font-size: 2em;
            font-weight: bold;
            margin-top: 0.5em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }}

        h2 {{
            font-size: 1.5em;
            font-weight: bold;
            margin-top: 1em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }}

        h3 {{
            font-size: 1.2em;
            font-weight: bold;
            margin-top: 0.8em;
            margin-bottom: 0.4em;
            page-break-after: avoid;
        }}

        h4, h5, h6 {{
            font-size: 1em;
            font-weight: bold;
            margin-top: 0.6em;
            margin-bottom: 0.3em;
            page-break-after: avoid;
        }}

        p {{
            margin-top: 0.5em;
            margin-bottom: 0.5em;
            text-align: justify;
        }}

        code {{
            font-family: monospace;
            background-color: {self.settings["code_background"]};
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 0.9em;
        }}

        pre {{
            background-color: {self.settings["code_background"]};
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            page-break-inside: avoid;
        }}

        pre code {{
            background-color: transparent;
            padding: 0;
        }}

        blockquote {{
            border-left: 4px solid #ddd;
            margin-left: 0;
            padding-left: 15px;
            color: #666;
            font-style: italic;
        }}

        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
            page-break-inside: {table_page_break};
            table-layout: fixed;
            word-wrap: break-word;
            font-size: {table_font_size};
        }}

        th, td {{
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }}

        th {{
            background-color: #f5f5f5;
            font-weight: bold;
        }}

        ul, ol {{
            margin-top: 0.5em;
            margin-bottom: 0.5em;
            padding-left: 2em;
        }}

        li {{
            margin-bottom: 0.3em;
        }}

        a {{
            color: #0066cc;
            text-decoration: none;
        }}

        img {{
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em auto;
        }}

        hr {{
            border: none;
            border-top: 1px solid #ddd;
            margin: 2em 0;
        }}

        .mermaid-rendered-pdf {{
            text-align: center;
            page-break-inside: avoid;
            margin: 1em 0;
        }}

        .mermaid-rendered-pdf svg {{
            max-width: 100%;
            height: auto;
        }}

        .metadata {{
            margin-bottom: 1.5em;
        }}

        .metadata h1 {{
            margin-bottom: 0;
        }}

        .banner {{
            margin-bottom: 1.5em;
        }}

        .banner img {{
            width: 100%;
            max-height: 200px;
            object-fit: cover;
            border-radius: 4px;
        }}

        .toc {{
            padding: 1.5em;
            background-color: #f9f9f9;
            border-radius: 4px;
            page-break-after: always;
        }}

        .toc h2 {{
            margin-top: 0;
            margin-bottom: 1em;
            font-size: 1.4em;
            color: {self.settings["heading_color"]};
            border-bottom: 1px solid #ddd;
            padding-bottom: 0.5em;
        }}

        .toc ul {{
            margin: 0;
            padding-left: 1.5em;
            list-style-type: none;
        }}

        .toc > ul {{
            padding-left: 0;
        }}

        .toc li {{
            margin-bottom: 0.4em;
            line-height: 1.4;
        }}

        .toc a {{
            color: #333;
            text-decoration: none;
        }}

        .toc a:hover {{
            color: #0066cc;
        }}

        .toc ul ul {{
            margin-top: 0.3em;
            font-size: 0.95em;
        }}
        """

    def _extract_banner(self, content: str) -> str | None:
        """
        Extract banner URL from frontmatter.

        Args:
            content: The markdown content with potential frontmatter

        Returns:
            Banner URL if found, None otherwise
        """
        import re

        if not content or not content.startswith("---"):
            return None

        lines = content.split("\n")
        end_index = -1

        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                end_index = i
                break

        if end_index > 0:
            for line in lines[1:end_index]:
                match = re.match(r"^\s*banner\s*:\s*[\"']?(.+?)[\"']?\s*$", line, re.IGNORECASE)
                if match:
                    banner_value = match.group(1).strip()
                    # Handle Obsidian-style [[image.png]] links
                    obsidian_match = re.match(r"\[\[(.+?)\]\]", banner_value)
                    if obsidian_match:
                        return obsidian_match.group(1)
                    return banner_value

        return None

    def _strip_content(self, content: str) -> str:
        """
        Process and strip content based on settings before PDF export.

        This method handles removal of various content elements based on
        plugin settings. Add new stripping logic here as needed.

        Args:
            content: The markdown content to process

        Returns:
            Processed content with specified elements removed
        """
        import re

        if not content:
            return content

        result = content
        remove_frontmatter = self.settings.get("remove_frontmatter", True)
        remove_banner = self.settings.get("remove_banner", True)

        # Handle frontmatter (YAML block at start of document)
        if result.startswith("---"):
            lines = result.split("\n")
            end_index = -1

            # Find the closing --- delimiter
            for i, line in enumerate(lines[1:], start=1):
                if line.strip() == "---":
                    end_index = i
                    break

            if end_index > 0:
                if remove_frontmatter:
                    # Remove entire frontmatter block
                    result = "\n".join(lines[end_index + 1 :]).lstrip("\n")
                elif remove_banner:
                    # Keep frontmatter but remove banner field
                    frontmatter_lines = []
                    for line in lines[1:end_index]:
                        if not re.match(r"^\s*banner\s*:", line, re.IGNORECASE):
                            frontmatter_lines.append(line)

                    if frontmatter_lines:
                        result = "---\n" + "\n".join(frontmatter_lines) + "\n---" + "\n".join(lines[end_index + 1 :])
                    else:
                        # No frontmatter left after removing banner
                        result = "\n".join(lines[end_index + 1 :]).lstrip("\n")

        # Future stripping logic can be added here
        # Example: if self.settings.get("remove_comments", False): ...

        return result

    def _get_markdown_extensions(self) -> list:
        """Get list of markdown extensions to use"""
        extensions = ["extra", "nl2br", "sane_lists"]

        if self.settings["enable_tables"]:
            extensions.append("tables")

        if self.settings["enable_code_highlighting"]:
            extensions.append("codehilite")

        if self.settings["enable_toc"]:
            extensions.append("toc")

        return extensions

    def _generate_metadata_html(self, title: str, note_path: str | None = None) -> str:
        """Generate HTML for note metadata (title only - date/author are in page footer)"""
        if not self.settings["include_title"]:
            return ""

        return f'<div class="metadata"><h1>{title}</h1></div>'

    def export_to_pdf(
        self,
        content: str,
        output_path: str,
        title: str = "Untitled",
        note_path: str | None = None,
        mermaid_svgs: list[str] | None = None,
    ) -> tuple[bool, str]:
        """
        Export markdown content to PDF

        Args:
            content: Markdown content to export
            output_path: Path where PDF should be saved
            title: Title of the document
            note_path: Optional path to the source note
            mermaid_svgs: Optional list of pre-rendered mermaid SVGs to inject

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            print(f"[PDF Export] Starting export to {output_path}")
            print(f"[PDF Export] Title: {title}")
            print(f"[PDF Export] Content length: {len(content)} chars")

            # Extract banner before stripping content (if we want to keep it)
            banner_url = None
            if not self.settings.get("remove_banner", True):
                banner_url = self._extract_banner(content)
                print(f"[PDF Export] Banner URL extracted: {banner_url}")

            # Strip content based on settings (frontmatter, banner, etc.)
            print("[PDF Export] Processing content (stripping frontmatter/banner if enabled)...")
            content = self._strip_content(content)
            print(f"[PDF Export] Content length after stripping: {len(content)} chars")

            # Convert markdown to HTML
            print("[PDF Export] Getting markdown extensions...")
            extensions = self._get_markdown_extensions()
            print(f"[PDF Export] Extensions: {extensions}")

            print("[PDF Export] Creating Markdown instance...")
            md = Markdown(extensions=extensions)

            print("[PDF Export] Converting markdown to HTML...")
            html_content = md.convert(content)
            print(f"[PDF Export] HTML length: {len(html_content)} chars")

            # Inject pre-rendered mermaid SVGs (replace placeholders left by frontend)
            if mermaid_svgs:
                import re

                for i, svg in enumerate(mermaid_svgs):
                    placeholder = f"<!-- MERMAID_PLACEHOLDER_{i} -->"
                    replacement = f'<div class="mermaid-rendered-pdf">{svg}</div>'
                    html_content = html_content.replace(placeholder, replacement)
                    # Also try the paragraph-wrapped version that markdown may produce
                    wrapped = f"<p>{placeholder}</p>"
                    html_content = html_content.replace(wrapped, replacement)
                print(f"[PDF Export] Injected {len(mermaid_svgs)} mermaid SVG(s)")

            # Add Table of Contents if enabled
            toc_html = ""
            if self.settings.get("enable_toc", False) and hasattr(md, "toc") and md.toc:
                print("[PDF Export] Adding Table of Contents...")
                toc_html = f'<div class="toc"><h2>Table of Contents</h2>{md.toc}</div>'

            # Add banner image if available
            banner_html = ""
            if banner_url:
                print(f"[PDF Export] Adding banner image: {banner_url}")
                banner_html = f'<div class="banner"><img src="{banner_url}" alt="Banner" /></div>'

            # Build complete HTML document
            print("[PDF Export] Generating metadata HTML...")
            metadata_html = self._generate_metadata_html(title, note_path)

            print("[PDF Export] Building full HTML document...")
            full_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{title}</title>
            </head>
            <body>
                {banner_html}
                {metadata_html}
                {toc_html}
                {html_content}
            </body>
            </html>
            """

            # Generate CSS
            print("[PDF Export] Generating CSS...")
            css = CSS(string=self._get_base_css())

            # Create font configuration for better font handling
            print("[PDF Export] Creating font configuration...")
            font_config = FontConfiguration()

            # Convert HTML to PDF
            print("[PDF Export] Creating HTML object...")
            html = HTML(string=full_html)

            print("[PDF Export] Writing PDF file...")
            html.write_pdf(output_path, stylesheets=[css], font_config=font_config)

            print(f"[PDF Export] SUCCESS! PDF exported to {output_path}")
            return True, f"PDF exported successfully to {output_path}"

        except Exception as e:
            print(f"[PDF Export] ERROR: {type(e).__name__}: {e!s}")
            import traceback

            traceback.print_exc()
            return False, f"Failed to export PDF: {e!s}"

    def export_note(
        self,
        note_path: str,
        content: str,
        output_filename: str | None = None,
        mermaid_svgs: list[str] | None = None,
    ) -> tuple[bool, str, str | None]:
        """
        Export a single note to PDF

        Args:
            note_path: Path to the note being exported
            content: Content of the note
            output_filename: Optional custom output filename
            mermaid_svgs: Optional list of pre-rendered mermaid SVGs to inject

        Returns:
            Tuple of (success: bool, message: str, pdf_path: Optional[str])
        """
        try:
            # Extract title from note path
            title = Path(note_path).stem.replace("-", " ").replace("_", " ").title()

            # Determine output path
            pdf_filename = output_filename if output_filename else f"{Path(note_path).stem}.pdf"

            # Create temporary directory for PDF
            temp_dir = tempfile.gettempdir()
            pdf_path = str(Path(temp_dir) / pdf_filename)

            # Export to PDF
            success, message = self.export_to_pdf(
                content=content, output_path=pdf_path, title=title, note_path=note_path, mermaid_svgs=mermaid_svgs
            )

            if success:
                return True, message, pdf_path
            return False, message, None

        except Exception as e:
            return False, f"Failed to export note: {e!s}", None

    def update_settings(self, new_settings: dict):
        """
        Update plugin settings

        Args:
            new_settings: Dictionary of settings to update
        """
        self.settings.update(new_settings)
        print(f"[{self.name}] Settings updated")

    def get_settings(self) -> dict[str, object]:
        """Get current plugin settings"""
        return dict(self.settings)

    def get_supported_page_sizes(self) -> list:
        """Get list of supported page sizes"""
        return ["A4", "Letter", "Legal", "A5", "A3"]

    def get_supported_orientations(self) -> list:
        """Get list of supported orientations"""
        return ["portrait", "landscape"]

    def get_supported_fonts(self) -> list:
        """Get list of supported font families"""
        return ["serif", "sans-serif", "monospace"]
