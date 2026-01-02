# Semantic Release Setup Guide

This guide explains how semantic-release is configured in this project and how to set up the required credentials.

## Overview

This project uses semantic-release to automate:
- Version management
- CHANGELOG generation
- GitHub releases
- Docker image builds and publishing

## Required GitHub Secrets

To enable the full release workflow, configure these secrets in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

### 1. GITHUB_TOKEN (Automatic)
- **Description**: Automatically provided by GitHub Actions
- **Required for**: Creating GitHub releases, pushing commits, and publishing to GitHub Container Registry
- **No action needed**: This token is automatically available in workflows

### 2. NPM_TOKEN (Optional)
- **Description**: Authentication token for publishing to npm registry
- **Required for**: Publishing packages to npm (if desired)
- **How to get**:
  1. Log in to [npmjs.com](https://www.npmjs.com/)
  2. Click your profile → `Access Tokens`
  3. Generate a new token with "Automation" type
  4. Copy and add as `NPM_TOKEN` secret in GitHub
- **Note**: If you don't want to publish to npm, you can skip this or set `"private": true` in package.json

### 3. DOCKER_USERNAME (Required for Docker Hub)
- **Description**: Your Docker Hub username
- **Required for**: Publishing Docker images to Docker Hub
- **Value**: Your Docker Hub username (e.g., `myusername`)

### 4. DOCKER_PASSWORD (Required for Docker Hub)
- **Description**: Docker Hub access token or password
- **Required for**: Authenticating with Docker Hub
- **How to get**:
  1. Log in to [hub.docker.com](https://hub.docker.com/)
  2. Click your profile → `Account Settings` → `Security`
  3. Click `New Access Token`
  4. Give it a description and generate
  5. Copy and add as `DOCKER_PASSWORD` secret in GitHub
- **Recommendation**: Use an access token instead of your password for better security

## Repository Settings

### Enable GitHub Actions
1. Go to `Settings` → `Actions` → `General`
2. Under "Workflow permissions", select "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"
4. Save

### Branch Protection (Recommended)
For the `main` branch:
1. Go to `Settings` → `Branches`
2. Add a branch protection rule for `main`
3. Consider enabling:
   - Require pull request reviews
   - Require status checks to pass
   - Do not allow bypassing the above settings

## How It Works

### Commit Convention
The project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature → Minor version bump (e.g., 1.0.0 → 1.1.0)
- `fix:` - Bug fix → Patch version bump (e.g., 1.0.0 → 1.0.1)
- `perf:` - Performance improvement → Patch version bump
- `docs:` - Documentation only → No version bump
- `chore:` - Maintenance → No version bump
- `BREAKING CHANGE:` - Breaking change → Major version bump (e.g., 1.0.0 → 2.0.0)

### Release Workflow

When you push to the `main` branch:

1. **Analyze Commits**: semantic-release analyzes commits since the last release
2. **Determine Version**: Calculates the next version based on commit types
3. **Update Files**:
   - `package.json` - version field
   - `docker-compose.yml` - image tag
   - `CHANGELOG.md` - generated release notes
4. **Commit Changes**: Creates a release commit with `[skip ci]` to avoid loops
5. **Create Git Tag**: Tags the release commit
6. **GitHub Release**: Creates a GitHub release with notes
7. **Build Docker Images**: Builds and pushes to:
   - Docker Hub: `username/authentik-gotify-bridge:latest` and `username/authentik-gotify-bridge:X.Y.Z`
   - GitHub Container Registry: `ghcr.io/owner/repo:latest` and `ghcr.io/owner/repo:X.Y.Z`

### Testing Locally

You can test semantic-release locally without making actual releases:

```bash
# Dry run (shows what would happen)
npx semantic-release --dry-run

# Or using yarn
yarn semantic-release --dry-run
```

## Example Release Scenario

### Scenario 1: Feature Release
```bash
git commit -m "feat: add webhook notification support"
git push origin main
```
Result: Version 1.0.0 → 1.1.0

### Scenario 2: Bug Fix Release
```bash
git commit -m "fix: resolve authentication timeout issue"
git push origin main
```
Result: Version 1.1.0 → 1.1.1

### Scenario 3: Breaking Change
```bash
git commit -m "feat: restructure API endpoints

BREAKING CHANGE: All API endpoints now require authentication token"
git push origin main
```
Result: Version 1.1.1 → 2.0.0

## Configuration Files

### .releaserc.json
Main semantic-release configuration defining:
- Branches to release from (`main`)
- Plugins and their order
- Files to update during release

### .github/workflows/release.yml
GitHub Actions workflow that:
- Triggers on pushes to `main`
- Runs semantic-release
- Builds and publishes Docker images
- Requires proper secrets to be configured

## Troubleshooting

### Release Not Triggered
- Ensure commits follow conventional commit format
- Check that commits are pushed to `main` branch
- Verify GitHub Actions are enabled
- Check workflow logs in Actions tab

### Docker Push Fails
- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are set
- Ensure Docker Hub access token has write permissions
- Check Docker Hub repository exists or can be auto-created

### npm Publish Fails
- Set `"private": true` in package.json if you don't want npm publishing
- Or provide valid `NPM_TOKEN` secret
- Ensure package name is available on npm

### Permission Errors
- Check GitHub Actions permissions in repository settings
- Ensure "Read and write permissions" is enabled
- Verify the workflow has necessary scopes

## Additional Resources

- [semantic-release documentation](https://semantic-release.gitbook.io/)
- [Conventional Commits specification](https://www.conventionalcommits.org/)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
