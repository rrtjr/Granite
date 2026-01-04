# Setting Up the Release Workflow

This guide explains how to set up the Git Flow-style release workflow for Granite.

## One-Time Setup

### 1. Create the Develop Branch

If you don't have a `develop` branch yet, create it from `main`:

```bash
# Ensure you're on main and it's up to date
git checkout main
git pull origin main

# Create develop branch
git checkout -b develop

# Push to remote
git push -u origin develop
```

### 2. Set Up Branch Protection Rules

On GitHub, configure branch protection for `main` and `develop`:

#### Main Branch Protection

Go to: **Settings → Branches → Add branch protection rule**

For `main`:
- **Branch name pattern**: `main`
- ✅ Require a pull request before merging
  - ✅ Require approvals: 1
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Required checks: `test`, `lint`, `security`
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches (optional)
- ❌ Allow force pushes: Never
- ❌ Allow deletions

#### Develop Branch Protection

For `develop`:
- **Branch name pattern**: `develop`
- ✅ Require a pull request before merging (optional, more flexible)
  - ✅ Require approvals: 1 (optional)
- ✅ Require status checks to pass before merging
  - Required checks: `test`, `lint`
- ❌ Allow force pushes: Only for admins (optional)
- ❌ Allow deletions

### 3. Update Default Branch (Optional)

If you want contributors to work on `develop` by default:

**Settings → Branches → Default branch** → Change to `develop`

This makes PRs target `develop` by default.

## Using the Release Script

The `scripts/release.sh` helper script automates the release process.

### Start a New Release

```bash
./scripts/release.sh start 0.8.0
```

This will:
1. Create a `release/0.8.0` branch from `develop`
2. Update the VERSION file to `0.8.0`
3. Commit and push the branch

### Finish a Release

After testing on the release branch:

```bash
./scripts/release.sh finish
```

This will:
1. Merge `release/0.8.0` to `main`
2. Create and push tag `v0.8.0`
3. Merge back to `develop`
4. Delete the release branch
5. Trigger GitHub Actions to build and publish

### Create a Hotfix

For urgent production fixes:

```bash
./scripts/release.sh hotfix 0.8.1
```

Then fix the bug, update VERSION, and finish:

```bash
echo "0.8.1" > VERSION
git add VERSION
git commit -m "Bump version to 0.8.1"
./scripts/release.sh hotfix-finish
```

## Manual Release Process

If you prefer not to use the script, follow these steps:

### Starting a Release

```bash
git checkout develop
git pull origin develop
git checkout -b release/0.8.0
echo "0.8.0" > VERSION
git add VERSION
git commit -m "Bump version to 0.8.0"
git push -u origin release/0.8.0
```

### Finishing a Release

```bash
# Merge to main
git checkout main
git pull origin main
git merge --no-ff release/0.8.0 -m "Release v0.8.0"
git tag -a v0.8.0 -m "Release version 0.8.0"
git push origin main --tags

# Merge back to develop
git checkout develop
git pull origin develop
git merge --no-ff release/0.8.0 -m "Merge release/0.8.0 back to develop"
git push origin develop

# Clean up
git branch -d release/0.8.0
git push origin --delete release/0.8.0
```

## Workflow Diagram

```
develop ─────●─────●─────●─────●────────────●──────→
             │                 │            ↗
             │                 ↓           ↗
release/X.Y  │           ●─────●─────●───↗
             │                       │
             │                       ↓
main ────────●───────────────────────●─────────────→
                                     │
                                     ↓
                                  v0.8.0 (tag)
```

## CI/CD Integration

The workflow integrates with GitHub Actions:

### On Push to Develop
- Runs tests (`test.yml`)
- Runs linting (`test.yml`)
- Runs security scans (`security-scan.yml`)

### On Release Branch
- Runs tests
- Runs linting
- Runs security scans

### On Tag Push (v*.*.*)
- Builds Docker images (AMD64, ARM64)
- Pushes to GitHub Container Registry
- Creates GitHub release
- Generates release notes

## Versioning Strategy

Follow [Semantic Versioning](https://semver.org/):

- **Major (1.0.0)**: Breaking changes
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.0.1)**: Bug fixes, backward compatible

### Examples

- Adding new plugin → Minor version (0.7.0 → 0.8.0)
- Fixing authentication bug → Patch version (0.7.0 → 0.7.1)
- Removing deprecated API → Major version (0.7.0 → 1.0.0)

## Release Checklist

Before finishing a release:

- [ ] All tests pass
- [ ] Code linting passes
- [ ] Security scan passes
- [ ] VERSION file updated
- [ ] Documentation updated
- [ ] Docker build succeeds
- [ ] No critical bugs

## Troubleshooting

### Script Fails with "Not on a release branch"

Ensure you're on a release branch:

```bash
git branch  # Check current branch
git checkout release/0.8.0  # Switch to release branch
```

### Tag Already Exists

Delete and recreate:

```bash
git tag -d v0.8.0
git push origin :refs/tags/v0.8.0
git tag -a v0.8.0 -m "Release version 0.8.0"
git push origin v0.8.0
```

### Merge Conflicts

Resolve conflicts:

```bash
# During merge, if conflicts occur
git status  # See conflicted files
# Edit files to resolve
git add .
git commit
```

## Best Practices

1. **Always start releases from `develop`**, not `main`
2. **Keep `main` stable** - only merge completed releases
3. **Test thoroughly** on release branches before merging
4. **Use meaningful commit messages** - they appear in release notes
5. **Update VERSION file** on every release
6. **Document breaking changes** in commit messages
7. **Tag immediately after merging** to main

## See Also

- [RELEASE_WORKFLOW.md](RELEASE_WORKFLOW.md) - Complete workflow documentation
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
