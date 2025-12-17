#!/bin/bash

# Granite Release Script
# Helper script to create releases following the Git Flow workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

print_info() {
    echo -e "${YELLOW}INFO: $1${NC}"
}

check_clean_working_tree() {
    if ! git diff-index --quiet HEAD --; then
        print_error "Working tree is not clean. Please commit or stash your changes."
        exit 1
    fi
}

check_branch_exists() {
    if ! git show-ref --verify --quiet refs/heads/$1; then
        print_error "Branch $1 does not exist."
        return 1
    fi
    return 0
}

validate_version() {
    if ! [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Invalid version format. Use X.Y.Z (e.g., 0.8.0)"
        exit 1
    fi
}

# Main script
show_usage() {
    cat << EOF
Granite Release Script

Usage:
  ./scripts/release.sh start <version>   - Start a new release
  ./scripts/release.sh finish             - Finish current release
  ./scripts/release.sh hotfix <version>   - Start a hotfix
  ./scripts/release.sh hotfix-finish      - Finish hotfix

Examples:
  ./scripts/release.sh start 0.8.0
  ./scripts/release.sh finish
  ./scripts/release.sh hotfix 0.8.1
  ./scripts/release.sh hotfix-finish

EOF
}

start_release() {
    local version=$1

    if [ -z "$version" ]; then
        print_error "Version is required"
        show_usage
        exit 1
    fi

    validate_version "$version"
    check_clean_working_tree

    print_info "Starting release $version"

    # Ensure we're on develop
    if ! check_branch_exists "develop"; then
        print_error "Develop branch doesn't exist. Creating from main..."
        git checkout main
        git checkout -b develop
        git push -u origin develop
    fi

    git checkout develop
    git pull origin develop

    # Create release branch
    local branch_name="release/$version"
    print_info "Creating branch $branch_name"
    git checkout -b "$branch_name"

    # Update VERSION file
    echo "$version" > VERSION
    git add VERSION
    git commit -m "Bump version to $version"

    # Push branch
    git push -u origin "$branch_name"

    print_success "Release branch $branch_name created"
    print_info "Next steps:"
    echo "  1. Test the release"
    echo "  2. Fix any bugs on this branch"
    echo "  3. Run: ./scripts/release.sh finish"
}

finish_release() {
    check_clean_working_tree

    # Get current branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)

    if [[ ! $current_branch =~ ^release/ ]]; then
        print_error "Not on a release branch. Current branch: $current_branch"
        exit 1
    fi

    # Extract version from branch name
    local version=${current_branch#release/}

    print_info "Finishing release $version"

    # Merge to main
    print_info "Merging to main..."
    git checkout main
    git pull origin main
    git merge --no-ff "$current_branch" -m "Release v$version"

    # Create tag
    print_info "Creating tag v$version..."
    git tag -a "v$version" -m "Release version $version"

    # Push main and tags
    print_info "Pushing to main..."
    git push origin main
    git push origin "v$version"

    # Merge back to develop
    print_info "Merging back to develop..."
    git checkout develop
    git pull origin develop
    git merge --no-ff "$current_branch" -m "Merge release/$version back to develop"
    git push origin develop

    # Delete release branch
    print_info "Deleting release branch..."
    git branch -d "$current_branch"
    git push origin --delete "$current_branch"

    print_success "Release $version completed!"
    print_info "GitHub Actions will now build and publish Docker images"
    print_info "Check: https://github.com/rrtjr/Granite/actions"
}

start_hotfix() {
    local version=$1

    if [ -z "$version" ]; then
        print_error "Version is required"
        show_usage
        exit 1
    fi

    validate_version "$version"
    check_clean_working_tree

    print_info "Starting hotfix $version"

    # Create from main
    git checkout main
    git pull origin main

    local branch_name="hotfix/$version"
    git checkout -b "$branch_name"

    print_success "Hotfix branch $branch_name created"
    print_info "Fix the bug, then update VERSION and run: ./scripts/release.sh hotfix-finish"
}

finish_hotfix() {
    check_clean_working_tree

    local current_branch=$(git rev-parse --abbrev-ref HEAD)

    if [[ ! $current_branch =~ ^hotfix/ ]]; then
        print_error "Not on a hotfix branch. Current branch: $current_branch"
        exit 1
    fi

    local version=${current_branch#hotfix/}

    # Check if VERSION file is updated
    local version_file=$(cat VERSION)
    if [ "$version_file" != "$version" ]; then
        print_error "VERSION file ($version_file) doesn't match branch version ($version)"
        echo "Update VERSION file to $version and commit before finishing hotfix"
        exit 1
    fi

    print_info "Finishing hotfix $version"

    # Merge to main
    git checkout main
    git pull origin main
    git merge --no-ff "$current_branch" -m "Hotfix v$version"
    git tag -a "v$version" -m "Hotfix version $version"
    git push origin main
    git push origin "v$version"

    # Merge to develop
    git checkout develop
    git pull origin develop
    git merge --no-ff "$current_branch" -m "Merge hotfix/$version to develop"
    git push origin develop

    # Delete hotfix branch
    git branch -d "$current_branch"
    git push origin --delete "$current_branch"

    print_success "Hotfix $version completed!"
}

# Main command router
case "${1:-}" in
    start)
        start_release "$2"
        ;;
    finish)
        finish_release
        ;;
    hotfix)
        start_hotfix "$2"
        ;;
    hotfix-finish)
        finish_hotfix
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
