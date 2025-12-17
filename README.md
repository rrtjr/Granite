<div align="center">
  <img src="docs/granite.png" alt="Granite Logo" width="200"/>

  # Granite

  > Your Self-Hosted Knowledge Base

  [![Test Suite](https://github.com/rrtjr/Granite/actions/workflows/test.yml/badge.svg)](https://github.com/rrtjr/Granite/actions/workflows/test.yml)
  [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

**Granite** is forked from [NoteDiscovery](https://github.com/gamosoft/notediscovery) and follows its own roadmap. Named as an allusion to Obsidian, Granite maintains the same lightweight philosophy while pursuing unique features and improvements.

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
- **Optional Authentication** - Simple password protection for self-hosted deployments
- **Zero Cost** - No subscriptions, no hidden fees
- **Fast & Lightweight** - Instant search and navigation
- **Beautiful Themes** - Multiple themes, easy to customize
- **Extensible** - Plugin system for custom features
- **Git Sync** - Automatic backups to Git with configurable intervals
- **PDF Export** - Convert notes to professionally styled PDFs
- **Responsive** - Works on desktop, tablet, and mobile
- **Simple Storage** - Plain markdown files in folders
- **Math Support** - LaTeX/MathJax for beautiful equations
- **HTML Export** - Share notes as standalone HTML files
- **Graph View** - Interactive visualization of connected notes

## Quick Start

### Running with Docker Compose (Recommended)

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

> **Security Note**: Authentication is **enabled by default** with password `admin`.
> - **Local/Testing**: Default credentials are fine
> - **Public Network**: Change password immediately - see [AUTHENTICATION.md](documentation/AUTHENTICATION.md)

**Requirements:**
- Docker
- Docker Compose

**What's Included:**
- ✅ Python 3.11 runtime
- ✅ All Python dependencies pre-installed
- ✅ Git pre-installed (for Git Sync plugin)
- ✅ Health checks and automatic restarts
- ✅ Optimized multi-stage build for minimal image size

### Running Locally (Without Docker)

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
- Python 3.8 or higher
- pip (Python package manager)
- Git (optional, only needed for Git Sync plugin)

**Dependencies installed:**
- FastAPI - Web framework
- Uvicorn - ASGI server
- PyYAML - Configuration handling
- aiofiles - Async file operations

## Documentation

Want to learn more?

- **[THEMES.md](documentation/THEMES.md)** - Theme customization and creating custom themes
- **[FEATURES.md](documentation/FEATURES.md)** - Complete feature list and keyboard shortcuts
- **[TAGS.md](documentation/TAGS.md)** - Organize notes with tags and combined filtering
- **[TEMPLATES.md](documentation/TEMPLATES.md)** - Create notes from reusable templates with dynamic placeholders
- **[MATHJAX.md](documentation/MATHJAX.md)** - LaTeX/Math notation examples and syntax reference
- **[MERMAID.md](documentation/MERMAID.md)** - Diagram creation with Mermaid (flowcharts, sequence diagrams, and more)
- **[PLUGINS.md](documentation/PLUGINS.md)** - Plugin system and available plugins
- **[API.md](documentation/API.md)** - REST API documentation and examples
- **[AUTHENTICATION.md](documentation/AUTHENTICATION.md)** - Enable password protection for your instance
- **[ENVIRONMENT_VARIABLES.md](documentation/ENVIRONMENT_VARIABLES.md)** - Configure settings via environment variables

### Plugin Documentation
- **[PLUGIN_GIT_SYNC.md](documentation/PLUGIN_GIT_SYNC.md)** - Automatic Git backups and version control
- **[PLUGIN_PDF_EXPORT.md](documentation/PLUGIN_PDF_EXPORT.md)** - Export notes to beautifully formatted PDFs
- **[PLUGIN_NOTE_STATISTICS.md](documentation/PLUGIN_NOTE_STATISTICS.md)** - Comprehensive note statistics and analytics

**Pro Tip:** If you clone this repository, you can mount the `documentation/` folder to view these docs inside the app:

```yaml
# In your docker-compose.yml
volumes:
  - ./data:/app/data              # Your personal notes
  - ./documentation:/app/data/docs:ro  # Mount docs subfolder inside the data folder (read-only)
```

Then access them at `http://localhost:8000` - the docs will appear as a `docs/` folder in the file browser!

## Contributing

**Before submitting a pull request**, especially for major changes, please:
- Read our **[Contributing Guidelines](CONTRIBUTING.md)**
- Open an issue first to discuss major features or significant changes
- Ensure your code follows the project's style and philosophy


## Security Considerations

Granite is designed for **self-hosted, private use**. Please keep these security considerations in mind:

### Network Security
- **Do NOT expose directly to the internet** without additional security measures
- Run behind a reverse proxy (nginx, Caddy) with HTTPS for production use
- Keep it on your local network or use a VPN for remote access
- By default, the app listens on `0.0.0.0:8000` (all network interfaces)

### Authentication
- **Password protection is ENABLED by default** with password: `admin`
- **CHANGE THE DEFAULT PASSWORD IMMEDIATELY** if exposing to a network!
- See **[AUTHENTICATION.md](documentation/AUTHENTICATION.md)** for complete setup instructions
- To disable auth, set `authentication.enabled: false` in `config.yaml`
- Change password with Docker: `docker-compose exec granite python generate_password.py`
- Perfect for single-user or small team deployments
- For multi-user setups, consider a reverse proxy with OAuth/SSO

### Data Privacy
- Your notes are stored as **plain text markdown files** in the `data/` folder
- No data is sent to external services
- Regular backups are recommended

### Best Practices
- Run on `localhost` or a private network only
- Use Docker for isolation and easier security management
- Keep your system and dependencies updated
- Review and audit any plugins you install
- Set appropriate file permissions on the `data/` directory

**TL;DR**: Perfect for personal use on your local machine or home network. Enable built-in password protection if needed, or use a reverse proxy with authentication if exposing to wider networks.

## License

MIT License - Free to use, modify, and distribute.

---

Made for the self-hosting community
