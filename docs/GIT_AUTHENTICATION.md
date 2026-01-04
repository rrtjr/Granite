# Git Authentication Setup Guide

This guide explains different methods to authenticate with your Git remote repository for the Git Sync plugin.

## Quick Comparison

| Method | Difficulty | Security | Best For |
|--------|-----------|----------|----------|
| **HTTPS + Personal Access Token** | ⭐ Easy | ⭐⭐ Good | Beginners, quick setup |
| **SSH (Manual Setup)** | ⭐⭐ Medium | ⭐⭐⭐ Excellent | Advanced users, existing keys |
| **SSH (Auto-generated)** | ⭐ Easy | ⭐⭐⭐ Excellent | Most users (recommended) |
| **Mount Existing SSH Keys** | ⭐⭐⭐ Advanced | ⭐⭐⭐ Excellent | DevOps, existing infrastructure |

---

## Method 1: HTTPS with Personal Access Token (Easiest)

**Best for**: Quick setup, beginners, testing

### Step 1: Create a Personal Access Token

**GitHub**:
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Granite Git Sync")
4. Select scopes: `repo` (full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

**GitLab**:
1. Go to GitLab → Preferences → Access Tokens
2. Name: "Granite Git Sync"
3. Scopes: `write_repository`
4. Click "Create personal access token"
5. **Copy the token**

### Step 2: Configure Git Remote with HTTPS

```bash
# Set remote to HTTPS
docker exec granite bash -c "cd /app/data && git remote set-url origin https://github.com/username/repo.git"

# Configure credential helper to remember token
docker exec granite git config --global credential.helper store

# Push once to save credentials (enter username and token when prompted)
docker exec -it granite bash -c "cd /app/data && git push origin main"
# Username: your_github_username
# Password: paste_your_personal_access_token_here
```

**Pros**:
- ✅ Quick setup (5 minutes)
- ✅ No SSH key management
- ✅ Works through firewalls

**Cons**:
- ❌ Token stored in plaintext in container
- ❌ Need to regenerate token if it expires

---

## Method 2: SSH with Auto-Generated Keys (Recommended)

**Best for**: Most users, balance of ease and security

### Step 1: Generate SSH Key via Plugin

```bash
# Generate SSH key automatically
docker exec granite python -c "
from backend.plugins import PluginManager
pm = PluginManager('plugins')
git = pm.plugins.get('git')
success, msg = git.generate_ssh_key('your.email@example.com')
print(msg)
"
```

**Or via API** (future feature - will be added to UI):
```bash
curl -X POST http://localhost:8000/api/plugins/git/ssh/generate
```

### Step 2: Get Your Public Key

```bash
# Get public key
docker exec granite cat /root/.ssh/id_ed25519.pub
```

### Step 3: Add to Git Provider

**GitHub**:
1. Go to GitHub → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Title: "Granite Docker"
4. Paste the public key
5. Click "Add SSH key"

**GitLab**:
1. Go to GitLab → Preferences → SSH Keys
2. Paste the public key
3. Title: "Granite Docker"
4. Click "Add key"

### Step 4: Test Connection

```bash
docker exec granite ssh -T git@github.com
# Should see: "Hi username! You've successfully authenticated..."
```

### Step 5: Set Remote to SSH

```bash
docker exec granite bash -c "cd /app/data && git remote set-url origin git@github.com:username/repo.git"
```

**Pros**:
- ✅ More secure than HTTPS
- ✅ No password/token needed
- ✅ Keys persist in Docker volume

**Cons**:
- ❌ Keys lost if container is recreated without volumes

---

## Method 3: Manual SSH Setup

**Best for**: Users who already have SSH keys, advanced users

### Step 1: Generate SSH Key

```bash
docker exec -it granite ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default location (/root/.ssh/id_ed25519)
# Press Enter twice for no passphrase (recommended for automation)
```

### Step 2-5: Same as Method 2

Follow steps 2-5 from Method 2 above.

---

## Method 4: Mount Existing SSH Keys

**Best for**: DevOps, CI/CD, users with existing SSH infrastructure

### Step 1: Update docker-compose.yml

```yaml
services:
  granite:
    volumes:
      - ./data:/app/data
      - ~/.ssh:/root/.ssh:ro  # Mount your SSH keys (read-only)
```

### Step 2: Restart Container

```bash
docker-compose down
docker-compose up -d
```

### Step 3: Verify Keys Are Mounted

```bash
docker exec granite ls -la /root/.ssh
# Should see id_ed25519, id_ed25519.pub, known_hosts, etc.
```

### Step 4: Test Connection

```bash
docker exec granite ssh -T git@github.com
```

**Pros**:
- ✅ Uses your existing keys
- ✅ Consistent across all containers
- ✅ Easy to manage centrally

**Cons**:
- ❌ Requires docker-compose.yml modification
- ❌ Security risk if container is compromised (mount as read-only!)

---

## Troubleshooting

### "Permission denied (publickey)"

**Cause**: SSH key not added to Git provider or wrong remote URL

**Solution**:
```bash
# Check current remote URL
docker exec granite bash -c "cd /app/data && git remote -v"

# Should be git@github.com:username/repo.git (SSH)
# Not https://github.com/username/repo.git (HTTPS)

# Fix if needed
docker exec granite bash -c "cd /app/data && git remote set-url origin git@github.com:username/repo.git"

# Verify SSH key is on GitHub/GitLab
docker exec granite cat /root/.ssh/id_ed25519.pub
```

### "Host key verification failed"

**Cause**: GitHub/GitLab host not in known_hosts

**Solution**:
```bash
# Add GitHub to known_hosts
docker exec granite ssh-keyscan github.com >> /root/.ssh/known_hosts

# Or for GitLab
docker exec granite ssh-keyscan gitlab.com >> /root/.ssh/known_hosts
```

### "error: cannot run ssh: No such file or directory"

**Cause**: openssh-client not installed (should be fixed in latest Docker image)

**Solution**:
```bash
# Rebuild container with latest Dockerfile
docker-compose down
docker-compose up -d --build
```

### Keys Lost After Container Restart

**Cause**: SSH keys not persisted in volume

**Solution**: Use Method 4 (mount SSH directory) or regenerate keys after restarts.

**Better Solution** - Add SSH directory as volume in docker-compose.yml:
```yaml
services:
  granite:
    volumes:
      - ./data:/app/data
      - granite-ssh:/root/.ssh  # Persist SSH keys

volumes:
  granite-ssh:
```

---

## Security Best Practices

### For HTTPS:
1. ✅ Use personal access tokens, not passwords
2. ✅ Set token expiration
3. ✅ Limit token scope to minimum required (`repo` only)
4. ✅ Rotate tokens periodically
5. ❌ Don't share tokens or commit them to git

### For SSH:
1. ✅ Use ed25519 keys (more secure than RSA)
2. ✅ Mount SSH directory as read-only in production
3. ✅ Use separate keys for each service
4. ✅ Add passphrase for extra security (manual entry on first use)
5. ❌ Don't share private keys

---

## Recommended Setup Flow

**For New Users**:
1. Start with **Method 1 (HTTPS)** to test the plugin
2. Once comfortable, switch to **Method 2 (Auto-generated SSH)**
3. Later, move to **Method 4 (Mounted SSH)** for persistence

**For Production**:
1. Use **Method 4 (Mounted SSH)** with read-only mount
2. Use deploy keys specific to each repository
3. Set up volume for SSH persistence
4. Implement key rotation policies

---

## See Also

- [Git Sync Plugin Documentation](PLUGIN_GIT_SYNC.md)
- [Docker Volumes Guide](https://docs.docker.com/storage/volumes/)
- [GitHub SSH Documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitLab SSH Documentation](https://docs.gitlab.com/ee/user/ssh.html)
