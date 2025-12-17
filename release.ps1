param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipCommit = $false
)

# Validate version format (semantic versioning)
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "Error: Version must be in format X.Y.Z (e.g., 0.4.0)" -ForegroundColor Red
    exit 1
}

# Check if we're on the main branch
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "main" -and $currentBranch -ne "master") {
    Write-Host "Error: Releases can only be created from the main branch." -ForegroundColor Red
    Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow
    Write-Host "Please switch to main branch first: git checkout main" -ForegroundColor Yellow
    exit 1
}

Write-Host "Releasing version $Version from branch: $currentBranch" -ForegroundColor Green

# Pull latest changes from remote
Write-Host "Pulling latest changes from origin/$currentBranch..." -ForegroundColor Yellow
$pullOutput = git pull origin $currentBranch 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nError: Failed to pull latest changes from remote." -ForegroundColor Red
    Write-Host $pullOutput -ForegroundColor Yellow
    
    # Check if it's a merge conflict
    if ($pullOutput -match "CONFLICT" -or $pullOutput -match "conflict") {
        Write-Host "`nMerge conflict detected! Please resolve conflicts manually:" -ForegroundColor Red
        Write-Host "  1. Resolve conflicts in affected files" -ForegroundColor Yellow
        Write-Host "  2. Stage resolved files: git add ." -ForegroundColor Yellow
        Write-Host "  3. Complete merge: git commit" -ForegroundColor Yellow
        Write-Host "  4. Re-run this script" -ForegroundColor Yellow
    } else {
        Write-Host "`nPlease resolve the issue and try again." -ForegroundColor Yellow
    }
    
    exit 1
}

if ($pullOutput -match "Already up to date") {
    Write-Host "Already up to date." -ForegroundColor Green
} else {
    Write-Host "Pull successful." -ForegroundColor Green
}

# Read current version and validate it's higher
if (Test-Path "VERSION") {
    $currentVersion = (Get-Content "VERSION" -Raw).Trim()
    
    if ($currentVersion -match '^\d+\.\d+\.\d+$') {
        # Parse versions into components
        $currentParts = $currentVersion -split '\.'
        $newParts = $Version -split '\.'
        
        $currentMajor = [int]$currentParts[0]
        $currentMinor = [int]$currentParts[1]
        $currentPatch = [int]$currentParts[2]
        
        $newMajor = [int]$newParts[0]
        $newMinor = [int]$newParts[1]
        $newPatch = [int]$newParts[2]
        
        # Compare versions
        $isHigher = $false
        if ($newMajor -gt $currentMajor) {
            $isHigher = $true
        } elseif ($newMajor -eq $currentMajor) {
            if ($newMinor -gt $currentMinor) {
                $isHigher = $true
            } elseif ($newMinor -eq $currentMinor) {
                if ($newPatch -gt $currentPatch) {
                    $isHigher = $true
                }
            }
        }
        
        if (-not $isHigher) {
            Write-Host "Error: New version must be higher than current version." -ForegroundColor Red
            Write-Host "Current version: $currentVersion" -ForegroundColor Yellow
            Write-Host "New version: $Version" -ForegroundColor Yellow
            Write-Host "`nVersion comparison:" -ForegroundColor Yellow
            Write-Host "  Major: $newMajor vs $currentMajor" -ForegroundColor Yellow
            Write-Host "  Minor: $newMinor vs $currentMinor" -ForegroundColor Yellow
            Write-Host "  Patch: $newPatch vs $currentPatch" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Version check passed: $currentVersion -> $Version" -ForegroundColor Green
    } else {
        Write-Host "Error: Current VERSION file has invalid format. Must be in X.Y.Z format (e.g., 0.4.0)" -ForegroundColor Red
        Write-Host "Current VERSION file contains: '$currentVersion'" -ForegroundColor Yellow
        Write-Host "Please fix the VERSION file before creating a release." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "No existing VERSION file found. Creating new one..." -ForegroundColor Yellow
}

# Check if working directory is clean (unless skipping commit)
if (-not $SkipCommit) {
    $status = git status --porcelain
    if ($status) {
        Write-Host "Warning: Working directory has uncommitted changes:" -ForegroundColor Yellow
        Write-Host $status -ForegroundColor Yellow
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-Host "Aborted." -ForegroundColor Red
            exit 1
        }
    }
}

# Update VERSION file (single source of truth)
Write-Host "Updating VERSION file..." -ForegroundColor Yellow
$Version | Out-File -FilePath "VERSION" -Encoding utf8 -NoNewline

# Commit changes (unless skipped)
if (-not $SkipCommit) {
    Write-Host "Committing version changes..." -ForegroundColor Yellow
    git add VERSION
    git commit -m "Updated version to $Version"
    
    # Push commits first
    # NOTE: This will trigger GitHub's built-in 'pages-build-deployment' workflow
    # if you have GitHub Pages configured and changes were made to docs/ folder
    Write-Host "Pushing commits..." -ForegroundColor Yellow
    git push
}

# Create git tag
Write-Host "Creating git tag v$Version..." -ForegroundColor Yellow
git tag -a "v$Version" -m "Release version $Version"

# Push tag to remote
Write-Host "Pushing tag to remote..." -ForegroundColor Yellow
git push origin "v$Version"

Write-Host "`nRelease $Version completed successfully!" -ForegroundColor Green
Write-Host "Tag: v$Version" -ForegroundColor Cyan

# Open GitHub Actions page to monitor build status
$actionsUrl = "https://github.com/rrtjr/Granite/actions"
Write-Host "`nOpening GitHub Actions to monitor build status..." -ForegroundColor Yellow
Start-Process $actionsUrl

