# Release Notes - v0.10.0

## What's Changed

### ✨ New Features
- **Advanced Performance Settings** - Power users can now fine-tune editor responsiveness with configurable delays for typing, autosave, statistics, metadata parsing, and undo history (⚙️ Settings → Advanced Settings → Performance Tuning) ([a65b5ff](https://github.com/rrtjr/granite/commit/a65b5ff))
- **Reading Preferences** - Customize your reading experience with adjustable content width (narrow/medium/wide/full), text alignment (left/center/justified), and content spacing (compact/normal/relaxed/extra-relaxed) ([b4d9b9a](https://github.com/rrtjr/granite/commit/b4d9b9a))
- **Sidebar Collapse Toggle** - Desktop users can now collapse/expand the sidebar with a convenient toggle button for distraction-free writing ([308742a](https://github.com/rrtjr/granite/commit/308742a))
- **Persistent Settings** - All reading preferences and performance settings are automatically saved to localStorage and persist across sessions

### 🐛 Bug Fixes
- Fixed settings not properly loading saved values when reopening settings modals ([83acdd4](https://github.com/rrtjr/granite/commit/83acdd4))
- Fixed Ctrl+V paste functionality - text pasting now works correctly while preserving image paste capability
- Fixed editor hanging during rapid typing/backspacing with aggressive performance optimizations

### 🚀 Performance Improvements
- Debounced editor updates to prevent lag during fast typing (100ms delay, configurable)
- Debounced statistics calculation (300ms delay, configurable)
- Debounced metadata parsing (300ms delay, configurable)
- Debounced undo history updates (500ms delay, configurable)
- Optimized reactive state updates for smoother editing experience

### 📝 Other Changes
- Updated README.md with latest documentation ([1d0a5eb](https://github.com/rrtjr/granite/commit/1d0a5eb))
- Restored status badges ([2c4569c](https://github.com/rrtjr/granite/commit/2c4569c))

## Docker Images

This release is available as a Docker image:
```bash
docker pull ghcr.io/rrtjr/granite:0.10.0
```

**Full Changelog**: https://github.com/rrtjr/granite/compare/v0.9.0...v0.10.0
