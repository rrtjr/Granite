# Stage 1: Install dependencies and build CodeMirror bundle
FROM python:3.11-slim AS builder

WORKDIR /app

# Install Node.js for building CodeMirror bundle
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Build editor bundles (CodeMirror + Tiptap)
COPY scripts/build/package.json scripts/build/codemirror-bundle-entry.js scripts/build/build-codemirror.js ./scripts/build/
COPY scripts/build-tiptap/package.json scripts/build-tiptap/package-lock.json scripts/build-tiptap/tiptap-bundle-entry.js scripts/build-tiptap/build-tiptap.js ./scripts/build-tiptap/
COPY frontend ./frontend
RUN npm install --prefix scripts/build && \
    npm run build --prefix scripts/build && \
    npm install --prefix scripts/build-tiptap && \
    npm run build --prefix scripts/build-tiptap && \
    ls -lh frontend/codemirror6.bundle.js frontend/tiptap.bundle.js && \
    echo "Editor bundles built successfully!"

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set uv environment variables
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install dependencies (cached layer)
COPY pyproject.toml .
RUN uv sync --no-install-project

# Copy source code and install project
COPY backend ./backend
COPY plugins ./plugins
RUN uv sync && \
    # Clean up unnecessary files to reduce image size
    find .venv -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find .venv -type f -name "*.pyc" -delete

# Stage 2: Final minimal image
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for plugins
# - git, openssh-client: Git Sync plugin
# - libpango-1.0-0, libpangocairo-1.0-0, libgdk-pixbuf-2.0-0, libcairo2, libffi-dev: WeasyPrint (PDF Export plugin)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        openssh-client \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-2.0-0 \
        libcairo2 \
        libffi-dev \
        shared-mime-info && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    # Configure git to trust the data directory (fixes ownership issues)
    git config --global --add safe.directory /app/data

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy frontend with built editor bundles
COPY --from=builder /app/frontend ./frontend

# Copy application files
COPY backend ./backend
COPY tests ./tests
COPY config.yaml .
COPY VERSION .
COPY plugins ./plugins
COPY themes ./themes
COPY generate_password.py .

# Create data directory
RUN mkdir -p data

# Expose port (default, can be overridden)
EXPOSE 8000

# Set default port (can be overridden via environment variable)
ENV PORT=8000

# Health check (uses PORT env var)
HEALTHCHECK --interval=60s --timeout=3s --start-period=5s --retries=3 \
    CMD .venv/bin/python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.getenv(\"PORT\", \"8000\")}/health')"

# Run the application (shell form to allow environment variable expansion)
CMD ["sh", "-c", ".venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]

