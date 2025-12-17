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

from markdown import Markdown
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
        }

    def _get_base_css(self) -> str:
        """Generate base CSS for PDF styling"""
        # Page numbers CSS
        page_numbers_css = ""
        if self.settings["include_page_numbers"]:
            page_numbers_css = """
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #666;
            }
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

        .metadata {{
            margin-bottom: 2em;
            padding-bottom: 1em;
            border-bottom: 2px solid #333;
        }}

        .metadata h1 {{
            margin-bottom: 0.2em;
        }}

        .metadata .date {{
            color: #666;
            font-size: 0.9em;
            margin-bottom: 0.2em;
        }}

        .metadata .author {{
            color: #666;
            font-size: 0.9em;
        }}
        """

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
        """Generate HTML for note metadata"""
        html_parts = ['<div class="metadata">']

        if self.settings["include_title"]:
            html_parts.append(f"<h1>{title}</h1>")

        if self.settings["include_date"]:
            current_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
            html_parts.append(f'<div class="date">Generated: {current_date}</div>')

        if self.settings["include_author"] and self.settings["author_name"]:
            html_parts.append(f'<div class="author">Author: {self.settings["author_name"]}</div>')

        html_parts.append("</div>")
        return "\n".join(html_parts)

    def export_to_pdf(
        self,
        content: str,
        output_path: str,
        title: str = "Untitled",
        note_path: str | None = None,
    ) -> tuple[bool, str]:
        """
        Export markdown content to PDF

        Args:
            content: Markdown content to export
            output_path: Path where PDF should be saved
            title: Title of the document
            note_path: Optional path to the source note

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            print(f"[PDF Export] Starting export to {output_path}")
            print(f"[PDF Export] Title: {title}")
            print(f"[PDF Export] Content length: {len(content)} chars")

            # Convert markdown to HTML
            print("[PDF Export] Getting markdown extensions...")
            extensions = self._get_markdown_extensions()
            print(f"[PDF Export] Extensions: {extensions}")

            print("[PDF Export] Creating Markdown instance...")
            md = Markdown(extensions=extensions)

            print("[PDF Export] Converting markdown to HTML...")
            html_content = md.convert(content)
            print(f"[PDF Export] HTML length: {len(html_content)} chars")

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
                {metadata_html}
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
        self, note_path: str, content: str, output_filename: str | None = None
    ) -> tuple[bool, str, str | None]:
        """
        Export a single note to PDF

        Args:
            note_path: Path to the note being exported
            content: Content of the note
            output_filename: Optional custom output filename

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
                content=content, output_path=pdf_path, title=title, note_path=note_path
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

    def get_settings(self) -> dict:
        """Get current plugin settings"""
        return self.settings.copy()

    def get_supported_page_sizes(self) -> list:
        """Get list of supported page sizes"""
        return ["A4", "Letter", "Legal", "A5", "A3"]

    def get_supported_orientations(self) -> list:
        """Get list of supported orientations"""
        return ["portrait", "landscape"]

    def get_supported_fonts(self) -> list:
        """Get list of supported font families"""
        return ["serif", "sans-serif", "monospace"]
