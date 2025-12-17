# Release Workflow

This document describes the release workflow for Granite using a Git Flow-inspired branching strategy.

## Branch Strategy

### Permanent Branches

- **`main`** - Production-ready code. Always stable and deployable.
- **`develop`** - Integration branch for features. All feature branches merge here first.

### Temporary Branches

- **`release/*`** - Release preparation branches (e.g., `release/0.8.0`)
- **`feature/*`** - Feature development branches (e.g., `feature/add-search-filters`)
- **`hotfix/*`** - Emergency fixes for production (e.g., `hotfix/fix-auth-bug`)

## Release Process

### 1. Create a Release Branch

When ready to release, create a release branch from `develop`:

```bash
# Update your develop branch
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/0.8.0

# Update VERSION file
echo "0.8.0" > VERSION

# Commit version bump
git add VERSION
git commit -m "Bump version to 0.8.0"

# Push release branch
git push origin release/0.8.0
```

### 2. Test and Fix Bugs

- Run all tests: `pytest`
- Fix any bugs found during testing
- Commit fixes directly to the release branch
- Update documentation if needed

```bash
# Fix bugs on release branch
git add .
git commit -m "Fix: bug description"
git push origin release/0.8.0
```

### 3. Merge to Main and Tag

Once testing is complete and the release is ready:

```bash
# Merge to main
git checkout main
git pull origin main
git merge --no-ff release/0.8.0 -m "Release v0.8.0"
git push origin main

# Create and push tag
git tag -a v0.8.0 -m "Release version 0.8.0"
git push origin v0.8.0
```

**This will trigger**:
- Docker image build and push to GHCR
- Automated GitHub release creation
- Multi-architecture builds (AMD64, ARM64)

### 4. Merge Back to Develop

Merge the release branch back to `develop` to keep it up to date:

```bash
git checkout develop
git pull origin develop
git merge --no-ff release/0.8.0 -m "Merge release/0.8.0 back to develop"
git push origin develop
```

### 5. Delete Release Branch

```bash
git branch -d release/0.8.0
git push origin --delete release/0.8.0
```

## Hotfix Process

For urgent production fixes:

### 1. Create Hotfix Branch from Main

```bash
git checkout main
git pull origin main
git checkout -b hotfix/0.8.1
```

### 2. Fix the Issue

```bash
# Make your fixes
git add .
git commit -m "Fix: critical bug description"

# Update VERSION
echo "0.8.1" > VERSION
git add VERSION
git commit -m "Bump version to 0.8.1"
```

### 3. Merge to Main and Tag

```bash
git checkout main
git merge --no-ff hotfix/0.8.1 -m "Hotfix v0.8.1"
git push origin main

git tag -a v0.8.1 -m "Hotfix version 0.8.1"
git push origin v0.8.1
```

### 4. Merge to Develop

```bash
git checkout develop
git merge --no-ff hotfix/0.8.1 -m "Merge hotfix/0.8.1 to develop"
git push origin develop
```

### 5. Delete Hotfix Branch

```bash
git branch -d hotfix/0.8.1
git push origin --delete hotfix/0.8.1
```

## Feature Development

For new features:

### 1. Create Feature Branch from Develop

```bash
git checkout develop
git pull origin develop
git checkout -b feature/add-search-filters
```

### 2. Develop the Feature

```bash
# Make changes
git add .
git commit -m "Add search filters functionality"
git push origin feature/add-search-filters
```

### 3. Create Pull Request

Create a PR from `feature/add-search-filters` → `develop`

### 4. Merge to Develop

After review and approval:

```bash
git checkout develop
git pull origin develop
git merge --no-ff feature/add-search-filters -m "Merge feature: add search filters"
git push origin develop
```

### 5. Delete Feature Branch

```bash
git branch -d feature/add-search-filters
git push origin --delete feature/add-search-filters
```

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0) - Breaking changes, incompatible API changes
- **MINOR** (0.1.0) - New features, backward compatible
- **PATCH** (0.0.1) - Bug fixes, backward compatible

### Examples

- `0.8.0` → `0.9.0` - New features added (minor version)
- `0.8.0` → `1.0.0` - Breaking changes (major version)
- `0.8.0` → `0.8.1` - Bug fixes only (patch version)

## Release Checklist

Before creating a release, ensure:

- [ ] All tests pass (`pytest`)
- [ ] Code linting passes (`ruff check`)
- [ ] Code formatting is correct (`ruff format`)
- [ ] VERSION file is updated
- [ ] CHANGELOG or release notes are prepared
- [ ] Documentation is updated
- [ ] No critical bugs or security issues
- [ ] Docker build succeeds locally

## Automated Release Process

When you push a tag (e.g., `v0.8.0`), GitHub Actions automatically:

1. **Builds** Docker images for AMD64 and ARM64
2. **Tests** the images
3. **Pushes** to GitHub Container Registry:
   - `ghcr.io/rrtjr/granite:0.8.0`
   - `ghcr.io/rrtjr/granite:0.8`
   - `ghcr.io/rrtjr/granite:0`
   - `ghcr.io/rrtjr/granite:latest`
4. **Creates** GitHub release with auto-generated release notes
5. **Generates** changelog from commit history

## Quick Reference

```bash
# Start new release
git checkout develop && git pull
git checkout -b release/X.Y.Z
echo "X.Y.Z" > VERSION && git add VERSION && git commit -m "Bump version to X.Y.Z"

# Finish release
git checkout main && git merge --no-ff release/X.Y.Z
git tag -a vX.Y.Z -m "Release version X.Y.Z"
git push origin main --tags
git checkout develop && git merge --no-ff release/X.Y.Z && git push origin develop
git branch -d release/X.Y.Z && git push origin --delete release/X.Y.Z

# Quick hotfix
git checkout main && git checkout -b hotfix/X.Y.Z
# Make fixes, update VERSION
git checkout main && git merge --no-ff hotfix/X.Y.Z && git tag -a vX.Y.Z -m "Hotfix X.Y.Z"
git push origin main --tags
git checkout develop && git merge --no-ff hotfix/X.Y.Z && git push origin develop
git branch -d hotfix/X.Y.Z && git push origin --delete hotfix/X.Y.Z
```

## Branch Protection Rules

Recommended branch protection for `main` and `develop`:

### Main Branch
- Require pull request reviews before merging
- Require status checks to pass (tests, linting)
- Require branches to be up to date before merging
- Do not allow force pushes
- Do not allow deletions

### Develop Branch
- Require pull request reviews before merging (optional)
- Require status checks to pass
- Allow force pushes for maintainers only
- Do not allow deletions

## Troubleshooting

### Tag Already Exists

If you need to recreate a tag:

```bash
# Delete local tag
git tag -d v0.8.0

# Delete remote tag
git push origin :refs/tags/v0.8.0

# Create new tag
git tag -a v0.8.0 -m "Release version 0.8.0"
git push origin v0.8.0
```

### Merge Conflicts

If you encounter conflicts during merge:

```bash
# Resolve conflicts in your editor
# Then add resolved files
git add .
git commit -m "Resolve merge conflicts"
git push
```

### Failed Build

If the automated build fails:

1. Check GitHub Actions logs
2. Fix the issue on the release/hotfix branch
3. Re-tag or trigger workflow manually

## See Also

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Semantic Versioning](https://semver.org/)
