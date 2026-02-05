<div align="center">
  <img src="docs/granite.png" alt="Granite Logo" width="200"/>

  # Granite

  > Self-Hosted Markdown Note-Taking

  [![Test Suite](https://github.com/rrtjr/Granite/actions/workflows/test.yml/badge.svg)](https://github.com/rrtjr/Granite/actions/workflows/test.yml)
  [![Docker Publish](https://github.com/rrtjr/Granite/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/rrtjr/Granite/actions/workflows/docker-publish.yml)
  [![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/version-0.18.0-green.svg)](VERSION)
</div>

A lightweight, self-hosted note-taking app with markdown support, wikilinks, tags, themes, and plugins. Your notes stay on your server as plain markdown files.

Forked from [NoteDiscovery](https://github.com/gamosoft/notediscovery).

**Why a fork?** I use this tool daily for my personal knowledge base, and I'm making changes as I see fit for my workflow. This allows me to iterate quickly on features and improvements that matter to me without waiting on upstream decisions. If you're looking for a more community-driven project, check out the original NoteDiscovery.

![Granite](docs/screenshot.jpg)

---

## Quick Start

### Docker Compose (Recommended)

```bash
git clone https://github.com/rrtjr/Granite.git granite
cd granite
docker-compose up -d
```

Access at [http://localhost:8000](http://localhost:8000)

**Security:** Authentication is disabled by default. If exposing to a network, see [AUTHENTICATION.md](docs/AUTHENTICATION.md).

### Using Pre-built Image

```bash
docker pull ghcr.io/rrtjr/granite:latest
docker-compose -f docker-compose.ghcr.yml up -d
```

### Local Python

```bash
git clone https://github.com/rrtjr/Granite.git granite
cd granite
pip install -r requirements.txt
python run.py
```

Requires Python 3.10+. Access at [http://localhost:8000](http://localhost:8000)

---

## Features

### Editor

- **Rich markdown editor** with syntax highlighting (CodeMirror 6)
- **Three view modes** - Edit, Split, Preview
- **Rich Editor mode** - WYSIWYG editing with Tiptap
- **Multiple panes** - Work on multiple notes side-by-side
- **Auto-save** - Never lose your work

### Content

- **Wikilinks** - `[[Note Name]]` Obsidian-style internal linking
- **Tags & search** - YAML frontmatter tags with combined filtering
- **LaTeX/MathJax** - Beautiful mathematical equations
- **Mermaid diagrams** - Flowcharts, sequence diagrams, and more
- **Draw.io diagrams** - Full-featured diagram editor with SVG preview caching
- **Spreadsheets** - Excel-like tables with formulas and cross-sheet references
- **Image support** - Drag & drop, clipboard paste, Obsidian-compatible format

### Organization

- **Folder hierarchy** - Organize notes in nested folders
- **Graph view** - Visualize note connections interactively
- **Templates** - Reusable note templates with dynamic placeholders
- **Direct URLs** - Deep linking to specific notes

### Customization

- **10 built-in themes** - Light, Dark, Dracula, Nord, Monokai, and more
- **Custom themes** - Create your own CSS themes
- **Plugins** - Git Sync, PDF Export, Note Statistics
- **Optional authentication** - Password protection when needed

## Documentation

Browse the [docs/](docs/) folder for detailed guides:

- [FEATURES.md](docs/FEATURES.md) - Full feature list and keyboard shortcuts
- [AUTHENTICATION.md](docs/AUTHENTICATION.md) - Enable password protection
- [PLUGINS.md](docs/PLUGINS.md) - Plugin system and development
- [THEMES.md](docs/THEMES.md) - Theme customization
- [MERMAID.md](docs/MERMAID.md) - Mermaid diagram syntax
- [DRAWIO.md](docs/DRAWIO.md) - Draw.io diagram editor
- [SPREADSHEETS.md](docs/SPREADSHEETS.md) - Spreadsheet formulas and features
- [API.md](docs/API.md) - REST API reference

**Tip:** Mount the docs folder to view them in the app:
```yaml
volumes:
  - ./docs:/app/data/docs:ro
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE)

---

<div align="center">

[Report Bug](https://github.com/rrtjr/Granite/issues) · [Request Feature](https://github.com/rrtjr/Granite/issues)

</div>
