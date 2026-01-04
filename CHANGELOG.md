# Changelog

All notable changes to Granite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.0] - 2026-01-04

### Added
- **Git Repository Path Display** - User settings now show the actual resolved git repository path for better visibility and debugging ([a07ccfa](https://github.com/rrtjr/granite/commit/a07ccfa))
- **GitHub Pages Documentation** - Added comprehensive documentation hosted on GitHub Pages for easier access ([f49370c](https://github.com/rrtjr/granite/commit/f49370c))
- Updated documentation and added new tests ([ae9f6cd](https://github.com/rrtjr/granite/commit/ae9f6cd))

### Fixed
- Fixed user-settings persistence bug to ensure settings are properly saved ([c63da8d](https://github.com/rrtjr/granite/commit/c63da8d))
- Fixed git sync scope plugin and PDF export plugin persistence issues ([7266479](https://github.com/rrtjr/granite/commit/7266479))
- Fixed sync scope handling in git sync plugin ([7a54806](https://github.com/rrtjr/granite/commit/7a54806))
- Fixed code linting issues ([2825e95](https://github.com/rrtjr/granite/commit/2825e95))
- Fixed test hygiene and logic issues ([d43a8a9](https://github.com/rrtjr/granite/commit/d43a8a9), [f06132c](https://github.com/rrtjr/granite/commit/f06132c))
- Fixed code formatting issues ([c7f61ae](https://github.com/rrtjr/granite/commit/c7f61ae))
- Fixed deprecation error on deploy pages workflow ([e9a1113](https://github.com/rrtjr/granite/commit/e9a1113))
- Fixed documentation loading script ([fbd27e9](https://github.com/rrtjr/granite/commit/fbd27e9))

### Changed
- Redesigned documentation index page for better user experience ([dff12a5](https://github.com/rrtjr/granite/commit/dff12a5))
- Optimized GitHub Pages deployment by removing Jekyll and using static build ([fc4b7e4](https://github.com/rrtjr/granite/commit/fc4b7e4), [6f40027](https://github.com/rrtjr/granite/commit/6f40027))

## [0.11.0] - 2025-12-20

### Added
- **Plugin Settings Persistence** - Plugin configurations are now automatically saved and persist across app restarts, ensuring your plugin settings are never lost ([547836c](https://github.com/rrtjr/granite/commit/547836c), [dd2e825](https://github.com/rrtjr/granite/commit/dd2e825))

### Fixed
- Fixed pasted image target link and markdown behavior to work correctly ([2a8e1c7](https://github.com/rrtjr/granite/commit/2a8e1c7))
- Fixed settings page layout for better consistency ([a15c22b](https://github.com/rrtjr/granite/commit/a15c22b))
- Fixed code linting issues ([bd691b1](https://github.com/rrtjr/granite/commit/bd691b1))

### Security
- **Security Updates** - Updated dependencies to fix vulnerabilities ([80503ad](https://github.com/rrtjr/granite/commit/80503ad)):
  - starlette 0.38.6 → 0.50.0 (fixes CVE-2024-47874, CVE-2025-54121)
  - filelock 3.12.4 → 3.20.1 (fixes CVE-2025-68146)
  - fastapi 0.115.0 → 0.125.0

### Changed
- **Migrated to uv** - Switched from pip to uv for faster, more reliable package management ([ec6071f](https://github.com/rrtjr/granite/commit/ec6071f))
- Fixed hatchling build configuration for GitHub Actions deployment ([e7300d7](https://github.com/rrtjr/granite/commit/e7300d7))
- Fixed release workflow to ensure proper CI/CD pipeline execution ([8d04dfb](https://github.com/rrtjr/granite/commit/8d04dfb))

## [0.10.0] - 2025-12-19

### Added
- Initial release tracking

## [0.9.0] - 2025-12-17

### Added
- Initial release tracking

## [0.8.0] - 2025-12-17

### Added
- Initial release tracking

---

[0.12.0]: https://github.com/rrtjr/granite/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/rrtjr/granite/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/rrtjr/granite/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/rrtjr/granite/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/rrtjr/granite/releases/tag/v0.8.0
