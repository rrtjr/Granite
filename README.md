<div align="center">
  <img src="docs/granite.png" alt="Granite Logo" width="200"/>

  # Granite

  > Your Self-Hosted Knowledge Base

  [![Test Suite](https://github.com/rrtjr/Granite/actions/workflows/test.yml/badge.svg)](https://github.com/rrtjr/Granite/actions/workflows/test.yml)
  [![Security Scan](https://github.com/rrtjr/Granite/actions/workflows/security-scan.yml/badge.svg)](https://github.com/rrtjr/Granite/actions/workflows/security-scan.yml)
  [![Docker Publish](https://github.com/rrtjr/Granite/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/rrtjr/Granite/actions/workflows/docker-publish.yml)
  [![Python 3.10+](https://img.shields.io/badge/python-3.10%20|%203.11%20|%203.12-blue.svg)](https://www.python.org/downloads/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/version-0.7.10-green.svg)](VERSION)
</div>

**Granite** is forked from [NoteDiscovery](https://github.com/gamosoft/notediscovery) and follows its own roadmap. Named as an allusion to Obsidian, Granite maintains the same lightweight philosophy while pursuing unique features and improvements.

Built with modern technologies and best practices, Granite provides a powerful yet lightweight solution for managing your personal knowledge base with complete privacy and control.

## What is Granite?

Granite is a **lightweight, self-hosted note-taking application** that puts you in complete control of your knowledge base. Write, organize, and discover your notes with a beautiful, modern interface—all running on your own server.

![Granite](docs/screenshot.jpg)

## Who is it for?

- **Privacy-conscious users** who want complete control over their data
- **Developers** who prefer markdown and local file storage
- **Knowledge workers** building a personal wiki or second brain
- **Teams** looking for a self-hosted alternative to commercial apps
- **Anyone** who values simplicity, speed, and ownership

## Why Granite?

### vs. Commercial Apps (Notion, Evernote, Obsidian Sync)

| Feature | Granite | Commercial Apps |
|---------|---------------|-----------------|
| **Cost** | 100% Free | $xxx/month/year |
| **Privacy** | Your server, your data | Their servers, their terms |
| **Speed** | Lightning fast | Depends on internet |
| **Offline** | Always works | Limited or requires sync |
| **Customization** | Full control | Limited options |
| **No Lock-in** | Plain markdown files | Proprietary formats |

### Key Benefits

- **Total Privacy** - Your notes never leave your server
- **Optional Authentication** - Built-in password protection for secure deployments
- **Zero Cost** - No subscriptions, no hidden fees, 100% free
- **Fast & Lightweight** - Instant search and navigation, minimal resource usage
- **Modern Editor** - CodeMirror 6 with syntax highlighting for 50+ languages
- **Beautiful Themes** - 8 built-in themes plus custom theme support
- **Extensible** - Powerful plugin system with hot-reload capabilities
- **Git Sync** - Automatic backups to Git with configurable intervals and SSH/HTTPS support
- **PDF Export** - Convert notes to professionally styled PDFs with one click
- **Note Templates** - Create notes from reusable templates with dynamic placeholders
- **Responsive** - Optimized for desktop, tablet, and mobile devices
- **Simple Storage** - Plain markdown files in folders, no proprietary formats
- **Math Support** - Full LaTeX/MathJax support for beautiful equations
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, Gantt charts, and more
- **Graph View** - Interactive visualization of note connections and relationships
- **Tags & Filtering** - Organize with YAML frontmatter tags and combined search
- **Note Properties** - Collapsible metadata panel with clickable tags
- **Wikilinks** - Obsidian-style `[[Note Name]]` internal linking

## Technology Stack

Granite is built with modern, production-ready technologies:

### Backend
- **FastAPI** - Modern, high-performance Python web framework
- **Uvicorn** - Lightning-fast ASGI server
- **Python 3.10+** - Tested on Python 3.10, 3.11, and 3.12
- **aiofiles** - Async file operations for optimal performance
- **PyYAML** - Configuration and frontmatter parsing
- **bcrypt** - Secure password hashing for authentication

### Frontend
- **Vanilla JavaScript** - No heavy frameworks, maximum performance
- **CodeMirror 6** - Advanced code editor with syntax highlighting
- **MathJax 3** - Beautiful mathematical equation rendering
- **Mermaid** - Diagram creation and visualization
- **Modern CSS** - Responsive design with custom themes

### Development & Quality
- **pytest** - Comprehensive test suite with coverage reporting
- **ruff** - Fast Python linter and formatter (replaces black, flake8, isort)
- **safety** - Dependency security scanning
- **pre-commit** - Git hooks for code quality enforcement
- **GitHub Actions** - Automated CI/CD with testing, linting, and security scans

### Infrastructure
- **Docker** - Multi-stage builds for minimal image size (~200MB)
- **Multi-architecture** - AMD64 and ARM64 support (Raspberry Pi compatible!)
- **GitHub Container Registry** - Automated image publishing
- **Health checks** - Built-in monitoring and auto-restart capabilities

## Deployment Options

Granite can be deployed in multiple ways to suit your needs:

### Docker Compose (Recommended)
- **Best for**: Most users, production deployments
- **Pros**: Consistent environment, easy updates, isolated
- **Setup time**: ~5 minutes

### Local Python
- **Best for**: Development, testing, customization
- **Pros**: Direct access to code, no Docker required
- **Setup time**: ~10 minutes

### Render (Cloud)
- **Best for**: Remote access, sharing with team, no server management
- **Pros**: Free tier available, automatic HTTPS, managed hosting
- **Setup time**: ~5 minutes (one-click deploy)

### Manual Production
- **Best for**: Advanced users with existing infrastructure
- **Requires**: Reverse proxy (nginx/Caddy), HTTPS, firewall configuration

---

## Quick Start

### Option 1: Docker Compose (Recommended)

Docker ensures consistent environment and easy deployment:

```bash
# Clone the repository
git clone https://github.com/rrtjr/Granite.git granite
cd granite

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:8000

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

> **Security Note**: Authentication is **disabled by default** for local use.
> - **Local/Testing**: Default setup is fine
> - **Public Network**: Enable authentication and change password - see [AUTHENTICATION.md](documentation/AUTHENTICATION.md)

**Pre-built Images Available:**
```bash
# Pull from GitHub Container Registry (faster than building)
docker pull ghcr.io/rrtjr/granite:latest

# Or use the ghcr docker-compose file
docker-compose -f docker-compose.ghcr.yml up -d
```

**Requirements:**
- Docker
- Docker Compose

**What's Included:**
- Python 3.11 runtime
- All dependencies pre-installed (Python, Node.js build tools)
- Git and SSH client (for Git Sync plugin)
- WeasyPrint dependencies (for PDF Export plugin)
- CodeMirror 6 bundle built and optimized
- Health checks and automatic restarts
- Multi-stage build for minimal image size (~200MB)
- Multi-architecture support (AMD64, ARM64)

### Option 2: Render (Cloud Deployment)

Deploy Granite to the cloud with one click:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rrtjr/Granite)

**What you get:**
- Free tier available (512MB RAM, sleeps after inactivity)
- Automatic HTTPS with custom domain support
- Auto-deploys from `render.yaml` configuration
- Uses pre-built images from GHCR for fast deployment
- Perfect for demos and shared team access

**Note**: Demo mode is enabled by default with authentication. See [render.yaml](render.yaml) for configuration.

### Option 3: Local Python (Development)

For development or if you prefer running directly:

```bash
# Clone the repository
git clone https://github.com/rrtjr/Granite.git granite
cd granite

# Install dependencies
pip install -r requirements.txt

# Run the application
python run.py

# Access at http://localhost:8000
```

**Requirements:**
- Python 3.10 or higher (3.10, 3.11, 3.12 tested)
- pip (Python package manager)
- Git (optional, only needed for Git Sync plugin)

**What gets installed:**
- FastAPI - Modern web framework
- Uvicorn - High-performance ASGI server
- PyYAML - Configuration and frontmatter parsing
- aiofiles - Async file operations
- bcrypt - Password hashing for authentication
- markdown - Markdown processing
- weasyprint - PDF export capabilities
- pytest - Testing framework
- ruff - Linting and formatting

**Note**: CodeMirror 6 bundle must be built separately for development:
```bash
cd scripts/build
npm install
npm run build
```

See [CODEMIRROR_BUNDLE.md](documentation/CODEMIRROR_BUNDLE.md) for details.

---

## Development

### Setting Up Development Environment

```bash
# Clone and enter directory
git clone https://github.com/rrtjr/Granite.git granite
cd granite

# Install dependencies
pip install -r requirements.txt

# Install pre-commit hooks (recommended)
pip install pre-commit
pre-commit install

# Run development server (with auto-reload)
# Edit config.yaml and set server.reload: true
python run.py
```

### Running Tests

```bash
# Run all tests with coverage
pytest

# Run specific test file
pytest tests/test_git_plugin.py

# Run with verbose output
pytest -v

# Generate HTML coverage report
pytest --cov=backend --cov=plugins --cov-report=html
# View at htmlcov/index.html
```

### Code Quality

```bash
# Lint code with ruff
ruff check backend/ plugins/

# Auto-fix linting issues
ruff check --fix backend/ plugins/

# Format code with ruff
ruff format backend/ plugins/

# Check security vulnerabilities
safety check
```

### Pre-commit Hooks

The repository includes pre-commit hooks that automatically run before each commit:
- **ruff** - Linting and formatting
- **pytest** - Run tests
- **safety** - Security vulnerability scanning

Install with: `pre-commit install`

### Building Docker Image

```bash
# Build locally
docker build -t granite:local .

# Build for multiple architectures (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t granite:local .

# Test the built image
docker run -p 8000:8000 -v $(pwd)/data:/app/data granite:local
```

### CI/CD Pipeline

Granite uses GitHub Actions for automated quality checks:

- **Test Suite** (`.github/workflows/test.yml`)
  - Runs on Python 3.10, 3.11, 3.12
  - pytest with coverage reporting
  - ruff linting and formatting checks
  - security vulnerability scanning with safety
  - Uploads coverage to Codecov

- **Security Scan** (`.github/workflows/security-scan.yml`)
  - Trivy filesystem scanning
  - Results uploaded to GitHub Security tab
  - Runs on push and pull requests

- **Docker Publish** (`.github/workflows/docker-publish.yml`)
  - Builds multi-architecture images (AMD64, ARM64)
  - Publishes to GitHub Container Registry
  - Auto-generates release notes
  - Triggers on version tags (v*.*.*)

## Documentation

### User Guides
- **[FEATURES.md](documentation/FEATURES.md)** - Complete feature list, keyboard shortcuts, and usage tips
- **[THEMES.md](documentation/THEMES.md)** - Theme customization and creating custom themes
- **[TAGS.md](documentation/TAGS.md)** - Organize notes with tags and combined filtering
- **[TEMPLATES.md](documentation/TEMPLATES.md)** - Create notes from reusable templates with dynamic placeholders
- **[MATHJAX.md](documentation/MATHJAX.md)** - LaTeX/Math notation examples and syntax reference
- **[MERMAID.md](documentation/MERMAID.md)** - Diagram creation with Mermaid (flowcharts, sequence diagrams, and more)

### Configuration & Security
- **[AUTHENTICATION.md](documentation/AUTHENTICATION.md)** - Enable password protection for your instance
- **[ENVIRONMENT_VARIABLES.md](documentation/ENVIRONMENT_VARIABLES.md)** - Configure settings via environment variables

### Plugin System
- **[PLUGINS.md](documentation/PLUGINS.md)** - Plugin system overview and creating custom plugins
- **[PLUGIN_GIT_SYNC.md](documentation/PLUGIN_GIT_SYNC.md)** - Automatic Git backups and version control
- **[PLUGIN_PDF_EXPORT.md](documentation/PLUGIN_PDF_EXPORT.md)** - Export notes to beautifully formatted PDFs
- **[PLUGIN_NOTE_STATISTICS.md](documentation/PLUGIN_NOTE_STATISTICS.md)** - Comprehensive note statistics and analytics
- **[GIT_AUTHENTICATION.md](documentation/GIT_AUTHENTICATION.md)** - Git authentication methods (HTTPS, SSH) for Git Sync plugin

### Developer Documentation
- **[API.md](documentation/API.md)** - REST API documentation and examples
- **[CODEMIRROR_BUNDLE.md](documentation/CODEMIRROR_BUNDLE.md)** - CodeMirror 6 bundle build process and architecture

**Pro Tip:** If you clone this repository, you can mount the `documentation/` folder to view these docs inside the app:

```yaml
# In your docker-compose.yml
volumes:
  - ./data:/app/data              # Your personal notes
  - ./documentation:/app/data/docs:ro  # Mount docs subfolder inside the data folder (read-only)
```

Then access them at `http://localhost:8000` - the docs will appear as a `docs/` folder in the file browser!

## Features Highlights

### Modern Markdown Editing
- **CodeMirror 6** - Advanced editor with syntax highlighting for 50+ languages
- **Three view modes** - Edit, Split, or Preview
- **Auto-save** - Never lose your work
- **Undo/Redo** - Full editing history with Ctrl+Z/Ctrl+Y
- **Copy code blocks** - One-click copy button on hover

### Powerful Linking System
- **Wikilinks** - `[[Note Name]]` Obsidian-style linking
- **Graph view** - Interactive visualization of note connections
- **Broken link detection** - See which links need attention
- **Direct URLs** - Deep linking with search highlighting (`?search=term`)
- **Drag to link** - Drag notes or images into editor to insert links

### Beautiful Themes
- **8 built-in themes** - Light, Dark, Dracula, Nord, Monokai, Vue High Contrast, Cobalt2, VS Blue
- **Custom theme support** - Create your own CSS themes
- **Instant switching** - No page reload required
- **Theme-aware components** - Graph view, math, and diagrams adapt to your theme

### Extensible Plugin System
- **Built-in plugins** - Git Sync, PDF Export, Note Statistics
- **Hot-reload** - Plugins activate immediately without restart
- **Settings UI** - Manage plugins visually with toggle switches
- **Event hooks** - React to note saves, deletes, searches
- **Easy development** - Simple Python API for creating plugins

### Smart Organization
- **YAML frontmatter tags** - Organize notes with metadata
- **Combined filtering** - Tags + text search together
- **Note properties panel** - Collapsible metadata display with clickable tags
- **Drag & drop** - Move notes and folders effortlessly
- **Folder hierarchy** - Nested folders for structured organization

### Performance & Reliability
- **Instant loading** - No lag, no loading spinners
- **Efficient caching** - Smart local storage
- **Minimal resources** - Runs on modest hardware (~200MB Docker image)
- **Health checks** - Built-in monitoring and auto-restart
- **Multi-architecture** - AMD64 and ARM64 support (Raspberry Pi compatible)

## Architecture Overview

```
granite/
├── backend/              # FastAPI application
│   ├── main.py          # Main application entry point
│   ├── plugins.py       # Plugin system manager
│   ├── themes.py        # Theme management
│   ├── utils.py         # Utility functions
│   └── core/            # Core functionality
│       ├── security.py      # Authentication & security
│       ├── middleware.py    # Request/response middleware
│       └── logging_config.py # Logging configuration
├── frontend/            # Static web interface
│   ├── index.html       # Main HTML template
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript modules
│   └── static/          # Static assets (CodeMirror bundle)
├── plugins/             # Plugin system
│   ├── git.py           # Git Sync plugin
│   ├── pdf_export.py    # PDF Export plugin
│   └── note_stats.py    # Note Statistics plugin
├── themes/              # CSS theme files
├── tests/               # Test suite
├── documentation/       # User documentation
├── data/                # User notes (mounted volume)
├── config.yaml          # Application configuration
├── requirements.txt     # Python dependencies
├── Dockerfile           # Multi-stage Docker build
├── docker-compose.yml   # Docker Compose configuration
└── pyproject.toml       # Python project configuration (ruff, pytest)
```

## Contributing

We welcome contributions! Here's how to get started:

1. **Read the Guidelines** - Check [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines
2. **Discuss First** - Open an issue for major changes before implementing
3. **Follow Style** - Use ruff for linting and formatting
4. **Write Tests** - Add tests for new features
5. **Update Docs** - Keep documentation current

### Quick Contributing Workflow

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/Granite.git
cd Granite

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
pip install -r requirements.txt
pytest
ruff check --fix backend/ plugins/
ruff format backend/ plugins/

# Commit and push
git commit -m "Add your feature"
git push origin feature/your-feature-name

# Open pull request on GitHub
```

### What We're Looking For
- **Bug fixes** - Always welcome!
- **Plugin development** - Extend functionality without changing core
- **Theme contributions** - New color schemes and designs
- **Documentation improvements** - Help others understand Granite
- **Performance optimizations** - Make it faster and lighter
- **Test coverage** - Improve reliability

### Philosophy
Granite prioritizes:
1. **Simplicity** - Easy to understand and maintain
2. **Lightweight** - Fast and minimal dependencies
3. **Privacy** - Self-hosted and secure
4. **Extensibility** - Plugin system for custom features

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines and expectations.

## Community & Support

### Getting Help
- **GitHub Issues** - Report bugs or request features
- **Discussions** - Ask questions and share ideas
- **Documentation** - Check the [documentation/](documentation/) folder

### Reporting Bugs
Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Python version, Docker)
- Error messages or logs
- Screenshots if applicable

### Feature Requests
Include:
- Problem you're trying to solve
- Proposed solution
- Alternatives considered
- Who would benefit

## Roadmap

### Planned Features
- Advanced search (full-text with filters)
- Note encryption at rest
- Obsidian vault import/export
- Database backend option (SQLite/PostgreSQL)

### Recently Completed
- CodeMirror 6 integration
- Multi-architecture Docker images (AMD64, ARM64)
- Git Sync plugin with SSH support
- PDF Export plugin
- Note Statistics plugin
- YAML frontmatter support
- Note templates system
- Mermaid diagram support
- Combined tag and search filtering
- Pre-commit hooks and CI/CD
- Render deployment support

To contribute to the roadmap, please open an issue for discussion.

## Security Considerations

Granite is designed for **self-hosted, private use**. Please keep these security considerations in mind:

### Network Security
- **Do NOT expose directly to the internet** without additional security measures
- Run behind a reverse proxy (nginx, Caddy) with HTTPS for production use
- Keep it on your local network or use a VPN for remote access
- By default, the app listens on `0.0.0.0:8000` (all network interfaces)

### Authentication
- **Authentication is DISABLED by default** for local development
- **Enable authentication** before exposing to any network
- See **[AUTHENTICATION.md](documentation/AUTHENTICATION.md)** for complete setup instructions
- Generate secure password hash: `python generate_password.py`
- Configure in `config.yaml` or via environment variables
- Perfect for single-user or small team deployments
- For multi-user setups, consider a reverse proxy with OAuth/SSO

**Quick Enable (Docker):**
```bash
# Generate new password hash
docker-compose exec granite python generate_password.py

# Enable in config.yaml
authentication:
  enabled: true
  password_hash: "<your_generated_hash>"
  secret_key: "<generate_with_python_secrets>"

# Or use environment variables
AUTHENTICATION_ENABLED=true
AUTHENTICATION_PASSWORD_HASH="<hash>"
AUTHENTICATION_SECRET_KEY="<key>"
```

### Data Privacy
- Your notes are stored as **plain text markdown files** in the `data/` folder
- No data is sent to external services
- No telemetry or tracking
- Regular backups are recommended (use Git Sync plugin!)
- Full control over your data

### Best Practices

**Recommended:**
- Run on `localhost` or a private network
- Use Docker for isolation and easier security management
- Enable authentication if accessible from network
- Keep your system and dependencies updated
- Use HTTPS in production (via reverse proxy)
- Review and audit any plugins you install
- Set appropriate file permissions on the `data/` directory
- Regular backups with Git Sync plugin

**Not Recommended:**
- Don't expose port 8000 directly to the internet
- Don't use default passwords in production

**TL;DR**: Perfect for personal use on your local machine or home network. Enable built-in password protection if needed, or use a reverse proxy with authentication if exposing to wider networks.

## Performance

Granite is designed to be fast and lightweight:

- **~200MB Docker image** - Multi-stage build eliminates build dependencies
- **< 100MB RAM** - Minimal memory footprint
- **Instant startup** - Ready in seconds
- **Fast search** - Efficient file system operations
- **Responsive UI** - No heavy JavaScript frameworks
- **Multi-architecture** - Optimized for AMD64 and ARM64 (Raspberry Pi!)

Tested successfully on:
- Raspberry Pi 4 (2GB RAM)
- Cloud VPS (512MB RAM)
- Desktop/Laptop (any modern system)

## Comparison with Alternatives

| Feature | Granite | Obsidian | Notion | Joplin |
|---------|---------|----------|--------|--------|
| **Hosting** | Self-hosted | Local + Optional Sync | Cloud | Local + Sync |
| **Cost** | Free | Free + Sync ($8-16/mo) | Free + Pro ($10/mo) | Free |
| **Privacy** | Total | High | Low (cloud-based) | High |
| **Web Interface** | Yes | No (desktop only) | Yes | Via server |
| **Plugin System** | Yes (Python) | Yes (JavaScript) | No (API only) | Yes (JavaScript) |
| **Markdown** | Pure | Pure | Blocks | Pure |
| **Mobile Apps** | Browser | iOS/Android | iOS/Android | iOS/Android |
| **Git Sync** | Built-in | Plugin/Manual | No | Manual |
| **Open Source** | Yes (MIT) | No | No | Yes (AGPL) |
| **Resource Usage** | Very Light | Light | Medium | Light |

## License

**MIT License** - Free to use, modify, and distribute.

See [LICENSE](LICENSE) for full text.

## Credits & Acknowledgments

- **Forked from**: [NoteDiscovery](https://github.com/gamosoft/notediscovery) by gamosoft
- **Inspired by**: [Obsidian](https://obsidian.md/) - The name "Granite" is a playful nod to Obsidian
- **Built with**: FastAPI, CodeMirror 6, MathJax, Mermaid, and many other open-source projects
- **Community**: Thank you to all contributors and users!

## Star History

If you find Granite useful, please consider giving it a star on GitHub!

[![Star History Chart](https://api.star-history.com/svg?repos=rrtjr/Granite&type=Date)](https://star-history.com/#rrtjr/Granite&Date)

---

<div align="center">

**Built for the self-hosting community**

[Report Bug](https://github.com/rrtjr/Granite/issues) · [Request Feature](https://github.com/rrtjr/Granite/issues) · [Documentation](documentation/)

</div>
