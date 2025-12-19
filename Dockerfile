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

# Build CodeMirror 6 bundle
COPY scripts/build/package.json scripts/build/codemirror-bundle-entry.js scripts/build/build-codemirror.js ./
COPY frontend ./frontend
RUN npm install && \
    npm run build && \
    ls -lh frontend/static/codemirror6.bundle.js && \
    echo "CodeMirror 6 bundle built successfully!"

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python packages using uv
COPY pyproject.toml .
RUN uv pip install --system --no-cache . && \
    # Clean up unnecessary files to reduce image size
    find /usr/local -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local -type f -name "*.pyc" -delete && \
    find /usr/local -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local -type d -name "*.dist-info" -exec rm -rf {}/RECORD {} + 2>/dev/null || true

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

# Copy only installed packages (no cache, no build artifacts)
COPY --from=builder /usr/local /usr/local

# Copy frontend with built CodeMirror bundle
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
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.getenv(\"PORT\", \"8000\")}/health')"

# Run the application (shell form to allow environment variable expansion)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]

