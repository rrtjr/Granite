# Contributing to Granite

Thank you for your interest in contributing to Granite!

This document provides guidelines and expectations for contributing to the project. Please read through this before submitting pull requests or opening issues.

## Our Philosophy

Granite is designed to be:
- **Lightweight** - Fast, minimal dependencies, quick to deploy
- **Simple** - Easy to understand, maintain, and customize
- **Self-hosted** - Complete control over your data, no external dependencies
- **Privacy-focused** - Your notes stay on your server

When considering contributions, we prioritize:
1. Maintaining simplicity and ease of use
2. Keeping the codebase maintainable
3. Preserving the lightweight nature of the application
4. Staying true to the self-hosted, privacy-first mission

## Before You Start

### Discuss Major Changes First

**Before submitting a pull request for a major feature or significant change, please:**

1. **Open an issue first** to discuss the idea
2. **Wait for feedback** from maintainers
3. **Get approval** before investing time in implementation

This helps ensure that:
- Your effort isn't wasted if the feature doesn't align with project goals
- We can discuss the best approach together
- Multiple people aren't working on the same thing
- The feature fits well with the existing architecture

### What Counts as a "Major Change"?

- New features that add significant functionality
- Changes to core architecture or data models
- New dependencies or significant changes to existing ones
- UI/UX overhauls or major design changes
- Changes to the plugin or theme system architecture
- Breaking changes to the API

## How to Contribute

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/Granite.git granite
cd granite
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Make Your Changes

- Follow the existing code style
- Write clear, readable code
- Add comments for complex logic
- Test your changes locally
- Update documentation if needed

### 4. Test Your Changes

**Option 1: Using Docker (Recommended)**
```bash
# Build and run
docker-compose up --build -d

# Run backend tests
docker-compose exec granite .venv/bin/pytest tests/ -v

# Run linting
docker-compose exec granite .venv/bin/ruff check backend/ plugins/ tests/
docker-compose exec granite .venv/bin/ruff format --check backend/ plugins/ tests/
```

**Option 2: Local Development with uv**
```bash
# Install uv (one-time)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Set up environment
uv sync

# Activate virtual environment
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate  # Windows

# Run backend tests
pytest tests/ -v

# Run linting
ruff check backend/ plugins/ tests/
ruff format --check backend/ plugins/ tests/

# Auto-fix issues
ruff check --fix backend/ plugins/ tests/
ruff format backend/ plugins/ tests/
```

**Frontend E2E Tests**

Frontend is tested via Playwright E2E tests that run in a real browser. These tests run automatically in CI on every push/PR.

```bash
# Local testing (optional - CI runs these automatically)
pip install playwright
playwright install chromium

# Run E2E tests (requires server at localhost:8000)
pytest tests/e2e -v

# With authentication enabled
TEST_PASSWORD=yourpassword pytest tests/e2e -v
```

**Note:** E2E tests are automatically skipped in Docker (no browser). In CI, they run after unit tests pass.

### 5. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git commit -m "Add dark mode toggle to settings"
```

### 6. Push and Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- A clear title and description
- Reference to any related issues
- Screenshots (if UI changes)
- Testing notes

## Code Style Guidelines

### Python

- Follow PEP 8 style guide (enforced by ruff)
- Use type hints where appropriate
- Keep functions focused and small
- Add docstrings for public functions/classes
- Run `ruff check --fix` and `ruff format` before committing
- All code must pass `ruff` linting and formatting checks

### JavaScript

- Use modern ES6+ syntax
- Keep functions focused and small
- Comment complex logic

### General

- Keep code simple and readable
- Avoid over-engineering
- Prefer explicit over implicit
- Write self-documenting code when possible

## Contributing Themes

Themes should:
- Follow the existing theme structure (see `themes/` directory)
- Be well-tested across different content types
- Include proper contrast ratios for accessibility
- Be named descriptively (e.g., `ocean-blue.css`, not `theme1.css`)

## Contributing Plugins

Plugins should:
- Follow the existing plugin structure (see `plugins/` directory)
- Include documentation in `documentation/PLUGINS.md`
- Be optional and not break core functionality if disabled
- Follow the plugin configuration format

## Contributing Documentation

Documentation improvements are always welcome! Please:
- Keep language clear and concise
- Use examples where helpful
- Update related documentation when making changes
- Check for typos and grammar

## When PRs Might Not Be Accepted

Even if your idea is great, a PR might not be accepted if:

1. **It doesn't align with project goals** - We aim to keep Granite lightweight and simple. Features that add significant complexity or dependencies may not fit.

2. **It wasn't discussed first** - Major changes should be discussed in an issue before implementation.

3. **It conflicts with existing work** - Sometimes we're already working on similar features or have different plans.

4. **It's too niche** - Features that only benefit a very small subset of users might be better as plugins.

5. **It adds unnecessary complexity** - We prefer simple, maintainable solutions over complex ones.

6. **It breaks backward compatibility** - Without a very good reason, we try to maintain compatibility.

### What to Do If Your PR Isn't Accepted

**Don't take it personally!** Here are some options:

1. **Fork and maintain your own version** - That's the beauty of open source! You can add any features you want in your fork.

2. **Create a plugin** - Many features can be implemented as plugins without changing core code.

3. **Revisit later** - Project priorities change. What doesn't fit now might fit later.

4. **Discuss alternatives** - We're happy to discuss if there's a simpler way to achieve your goal.

## Reporting Bugs

When reporting bugs, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Python version, Docker, etc.)
- Error messages or logs
- Screenshots if applicable

## Suggesting Features

When suggesting features:
- Explain the problem you're trying to solve
- Describe your proposed solution
- Discuss alternatives you've considered
- Explain who would benefit from this feature

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues and documentation first
- Be patient and respectful in discussions

## Legal Notes

### Licensing Contributions

By submitting a pull request, you agree that your contributions will be licensed under the [MIT License](LICENSE), the same license that covers the entire project. You retain copyright to your contributions, but grant permission for them to be used, modified, and distributed under the MIT License.

No additional license sections or attribution files are required - the project's MIT License covers all contributions.

## Thank You!

Your contributions, whether code, documentation, bug reports, or feature suggestions, are greatly appreciated. Even if a specific PR isn't merged, your ideas and feedback help make Granite better.

---

**Remember**: The goal is to build something useful together while keeping the project maintainable and true to its core values. Thank you for understanding!

