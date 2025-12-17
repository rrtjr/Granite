# PDF Export Plugin

The PDF Export plugin allows you to export your Granite markdown notes to beautifully formatted PDF files. It converts markdown to styled PDFs with proper formatting, code highlighting, and customizable page settings.

## Features

- **Markdown to PDF Conversion**: Convert markdown notes to professionally styled PDFs
- **Configurable Page Settings**: Customize page size, orientation, and margins
- **Multiple Page Sizes**: Support for A4, Letter, Legal, A3, and A5 formats
- **Custom Styling**: Choose from serif, sans-serif, or monospace fonts
- **Code Highlighting**: Syntax highlighting for code blocks
- **Metadata Support**: Include title, date, and author information
- **Tables Support**: Full support for markdown tables
- **Responsive Images**: Images are automatically scaled to fit the page

## Requirements

The plugin requires the following Python packages (automatically installed):

- `weasyprint` - HTML to PDF conversion engine
- `markdown` - Markdown to HTML conversion

## Installation

### Docker Installation (Recommended)

The PDF Export plugin is included with Granite. You just need to enable it and install the dependencies:

1. Open Granite
2. Click the **Settings** icon in the sidebar
3. Scroll to the **Plugins** section
4. Toggle **PDF Export** to enable it
5. The required dependencies will be installed automatically when you build/run the container

### Manual Installation (Without Docker)

If running Granite locally, install the required dependencies:

```bash
pip install weasyprint markdown
```

Then enable the plugin in Granite Settings.

## Usage

### Exporting a Note to PDF

There are two ways to export notes to PDF:

#### Method 1: Via API (For Frontend Integration)

Send a POST request to the export endpoint:

```bash
curl -X POST http://localhost:8000/api/plugins/pdf_export/export \
  -H "Content-Type: application/json" \
  -d '{
    "note_path": "my-note.md",
    "content": "# My Note\n\nThis is my note content."
  }'
```

The response will be a PDF file download.

#### Method 2: Programmatically (From Plugin)

```python
plugin = plugin_manager.plugins.get('pdf_export')
success, message, pdf_path = plugin.export_note(
    note_path="my-note.md",
    content="# My Note\n\nThis is my note content.",
    output_filename="custom-name.pdf"  # Optional
)
```

## Plugin Methods

The PDF Export plugin provides several methods for programmatic access:

### `export_note(note_path, content, output_filename=None)`
Exports a note to PDF with the specified content.

**Parameters:**
- `note_path` (str): Path to the source note file
- `content` (str): Markdown content to convert
- `output_filename` (str, optional): Custom filename for the PDF

**Returns:** `(success: bool, message: str, pdf_path: str)`

### `export_to_pdf(content, output_path, title=None, note_path=None)`
Lower-level export method with direct control over output path.

**Parameters:**
- `content` (str): Markdown content to convert
- `output_path` (str): Full path where PDF should be saved
- `title` (str, optional): Document title
- `note_path` (str, optional): Source note path for metadata

**Returns:** `(success: bool, message: str)`

### `update_settings(new_settings)`
Updates plugin configuration settings.

**Parameters:**
- `new_settings` (dict): Dictionary of settings to update

**Example:**
```python
plugin.update_settings({
    'page_size': 'Letter',
    'font_family': 'sans-serif',
    'include_page_numbers': False
})
```

### `get_settings()`
Returns the current plugin settings.

**Returns:** `dict` - Current settings dictionary

### `get_supported_page_sizes()`
Returns list of supported page sizes.

**Returns:** `list` - `['A4', 'Letter', 'Legal', 'A5', 'A3']`

### `get_supported_orientations()`
Returns list of supported page orientations.

**Returns:** `list` - `['portrait', 'landscape']`

### `get_supported_fonts()`
Returns list of supported font families.

**Returns:** `list` - `['serif', 'sans-serif', 'monospace']`

## Configuration

### Available Settings

The plugin provides extensive configuration options:

```python
{
    # Page settings
    'page_size': 'A4',          # A4, Letter, Legal, A5, A3
    'orientation': 'portrait',   # portrait or landscape
    'margin_top': '2cm',
    'margin_bottom': '2cm',
    'margin_left': '2cm',
    'margin_right': '2cm',

    # Content settings
    'include_title': True,
    'include_date': True,
    'include_author': False,
    'author_name': '',
    'include_page_numbers': True,  # Show page numbers in footer

    # Style settings
    'font_family': 'serif',     # serif, sans-serif, monospace
    'font_size': '11pt',
    'line_height': '1.6',
    'code_background': '#f5f5f5',
    'table_text_size': '10pt',  # Font size for table text
    'heading_color': '#333',    # Color for headings

    # Markdown extensions
    'enable_tables': True,
    'enable_code_highlighting': True,
    'enable_toc': False,        # Table of contents

    # Advanced settings
    'break_tables_across_pages': False,  # Allow tables to span multiple pages
    'compress_tables': True     # Use smaller font in tables for better fit
}
```

### Updating Settings via API

```bash
curl -X POST http://localhost:8000/api/plugins/pdf_export/settings \
  -H "Content-Type: application/json" \
  -d '{
    "page_size": "Letter",
    "font_family": "sans-serif",
    "include_author": true,
    "author_name": "John Doe"
  }'
```

### Getting Current Settings

```bash
curl http://localhost:8000/api/plugins/pdf_export/settings
```

### Getting Available Options

```bash
curl http://localhost:8000/api/plugins/pdf_export/options
```

Returns:
```json
{
    "page_sizes": ["A4", "Letter", "Legal", "A5", "A3"],
    "orientations": ["portrait", "landscape"],
    "fonts": ["serif", "sans-serif", "monospace"]
}
```

## API Reference

### Endpoints

#### GET `/api/plugins/pdf_export/settings`
Get current plugin settings.

**Response:**
```json
{
    "settings": {
        "page_size": "A4",
        "orientation": "portrait",
        ...
    }
}
```

#### POST `/api/plugins/pdf_export/settings`
Update plugin settings.

**Request Body:**
```json
{
    "page_size": "Letter",
    "font_family": "sans-serif",
    "margin_top": "1.5cm"
}
```

**Response:**
```json
{
    "success": true,
    "message": "PDF export settings updated",
    "settings": { ... }
}
```

#### POST `/api/plugins/pdf_export/export`
Export a note to PDF.

**Request Body:**
```json
{
    "note_path": "my-note.md",
    "content": "# My Note\n\nContent here...",
    "output_filename": "custom-name.pdf"  // Optional
}
```

**Response:** Binary PDF file download

#### GET `/api/plugins/pdf_export/options`
Get available export options (page sizes, orientations, fonts).

**Response:**
```json
{
    "page_sizes": ["A4", "Letter", "Legal", "A5", "A3"],
    "orientations": ["portrait", "landscape"],
    "fonts": ["serif", "sans-serif", "monospace"]
}
```

## PDF Styling

### Default Styles

The plugin applies professional styling by default:

- **Headers**: Bold with hierarchical sizing (h1 > h2 > h3)
- **Body Text**: Justified alignment, comfortable line height
- **Code Blocks**: Syntax highlighting with light gray background
- **Tables**: Bordered cells with header styling
- **Blockquotes**: Left border with italic text
- **Links**: Blue, underlined
- **Images**: Centered, auto-scaled to fit page

### Page Layout

- **Page Numbers**: Automatically added at bottom-right
- **Metadata Section**: Title, date, and author (if enabled) at the top
- **Break Avoidance**: Headers and code blocks avoid page breaks when possible

## Examples

### Basic Export

```python
# Export with default settings
plugin.export_note(
    note_path="meeting-notes.md",
    content="# Meeting Notes\n\n- Point 1\n- Point 2"
)
```

### Custom Filename

```python
# Export with custom filename
plugin.export_note(
    note_path="report.md",
    content="# Q4 Report\n\nSales increased by 20%.",
    output_filename="Q4-Report-2024.pdf"
)
```

### With Custom Settings

```python
# Update settings first
plugin.update_settings({
    'page_size': 'Letter',
    'orientation': 'landscape',
    'font_family': 'sans-serif',
    'include_author': True,
    'author_name': 'Jane Smith'
})

# Then export
plugin.export_note(
    note_path="presentation.md",
    content="# Presentation\n\nSlide content..."
)
```

## Troubleshooting

### WeasyPrint Installation Issues

If you encounter issues installing WeasyPrint, you may need system dependencies:

**Ubuntu/Debian:**
```bash
sudo apt-get install python3-dev python3-pip python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```

**macOS:**
```bash
brew install cairo pango gdk-pixbuf libffi
```

**Windows:**
- Install GTK3: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer

### PDF Not Generated

1. Check that the plugin is enabled
2. Verify the content is valid markdown
3. Check server logs for detailed error messages
4. Ensure you have write permissions to the temp directory

### Missing Fonts

If custom fonts don't appear correctly:
- WeasyPrint uses system fonts
- Install additional fonts on your system if needed
- Use standard font families (serif, sans-serif, monospace) for best compatibility

### Large Files

For very large notes:
- Consider splitting into multiple PDFs
- Reduce image sizes before exporting
- Adjust page margins to fit more content

## Frontend Integration

To add a PDF export button to your frontend:

```javascript
async function exportToPDF(notePath, content) {
    const response = await fetch('/api/plugins/pdf_export/export', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            note_path: notePath,
            content: content
        })
    });

    if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = notePath.replace('.md', '.pdf');
        a.click();
        window.URL.revokeObjectURL(url);
    }
}
```

## Technical Details

### Conversion Pipeline

1. **Markdown to HTML**: Uses Python `markdown` library with extensions
2. **Styling**: Applies CSS for professional formatting
3. **PDF Generation**: WeasyPrint converts HTML+CSS to PDF
4. **Font Handling**: Uses system fonts with FontConfiguration

### Supported Markdown Features

- Headers (h1-h6)
- Paragraphs
- Lists (ordered and unordered)
- Code blocks (inline and fenced)
- Tables
- Blockquotes
- Links
- Images
- Horizontal rules
- Bold, italic, strikethrough

### Limitations

- Interactive elements (forms, buttons) are not supported
- JavaScript is not executed
- Some CSS3 features may not be fully supported
- Maximum recommended page count: ~500 pages

## Security Considerations

- The plugin uses temporary directories for PDF generation
- Temporary files are automatically cleaned up by the OS
- No sensitive data is logged
- Input validation prevents path traversal attacks

## Performance

- Small notes (<10 pages): < 1 second
- Medium notes (10-50 pages): 1-3 seconds
- Large notes (50-100 pages): 3-10 seconds
- Very large notes (>100 pages): 10+ seconds

## Version History

- **v1.0.0** (Initial Release)
  - Markdown to PDF conversion
  - Configurable page settings
  - Custom styling options
  - API endpoints for export

## Support

For issues, questions, or feature requests:
- Check the [Granite documentation](../README.md)
- Review the [plugin development guide](PLUGINS.md)
- Open an issue on the Granite repository
