# CodeMirror 6 Bundle Build Instructions

This directory contains scripts to build a local CodeMirror 6 bundle for Granite. This approach eliminates the "multiple instances of @codemirror/state" error that occurs with CDN-based ESM imports.

## Why Bundle Locally?

CodeMirror 6 has a complex modular architecture with many interdependent packages. When loaded via CDN (Skypack, esm.sh, jsDelivr), browsers sometimes load multiple instances of `@codemirror/state`, breaking `instanceof` checks and causing initialization errors.

A local bundle:
- Guarantees a single shared instance of all CodeMirror modules
- Loads faster (one request vs many)
- Works offline
- Eliminates CDN reliability issues

## Build Steps

The CodeMirror bundle is **automatically built during Docker image creation**. No manual build steps are required for production deployment.

### Manual Build (Development Only)

If you need to rebuild the bundle locally for development:

```bash
cd scripts/build
npm install
npm run build
```

This creates `frontend/codemirror6.bundle.js` (~200KB minified).

## What Gets Bundled

The bundle includes all CodeMirror 6 features used by Granite:
- Core editor (EditorView, EditorState)
- Markdown language support
- Line numbers and gutter
- Syntax highlighting
- Search functionality
- Autocompletion
- Code folding
- Standard keymaps (undo/redo, indentation, etc.)
- Bracket matching and auto-closing

## Update Process

If you need to update CodeMirror versions:

1. Update version numbers in `scripts/build/package.json`
2. Rebuild the Docker image: `docker-compose build`
3. The new bundle will be automatically created during the build

## File Descriptions

- `scripts/build/package.json` - CodeMirror 6 dependencies and build script
- `scripts/build/build-codemirror.js` - esbuild configuration
- `scripts/build/codemirror-bundle-entry.js` - Bundle entry point that exports CodeMirror to `window.CodeMirror`
- `frontend/codemirror6.bundle.js` - Generated bundle file (created during Docker build)
