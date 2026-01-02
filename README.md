# authentik-gotify-bridge

A bridge between Authentik and Gotify for notifications.

## Prerequisites

- Node.js (v20 or higher)
- yarn
- Docker (optional, for containerized deployment)

## Installation

```bash
yarn install
```

## Development

Run the application in development mode with automatic restart on file changes:

```bash
yarn dev
```

This will start the application with tsx in watch mode, automatically restarting when changes are detected in the `src` directory.

## Building

Build the TypeScript project to JavaScript:

```bash
yarn build
```

The compiled JavaScript files will be placed in the `dist` directory.

## Production

Run the built application:

```bash
yarn start
```

## Scripts

- `yarn dev` - Run in development mode with watch mode
- `yarn build` - Compile TypeScript to JavaScript
- `yarn start` - Run the compiled application
- `yarn clean` - Remove the dist directory
- `yarn semantic-release` - Run semantic-release locally (requires proper git setup)

## Docker

### Building the Docker Image

```bash
docker build -t authentik-gotify-bridge:latest .
```

### Running with Docker Compose

```bash
docker-compose up -d
```

The `docker-compose.yml` file includes the service configuration. Make sure to set the required environment variables before running.

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and releasing.

**📖 For detailed setup instructions, see [SEMANTIC_RELEASE_SETUP.md](SEMANTIC_RELEASE_SETUP.md)**

### How it Works

1. **Commit Analysis**: Commits are analyzed to determine the type of release (major, minor, patch)
2. **Version Update**: The version in `package.json` and `docker-compose.yml` is automatically updated
3. **Changelog Generation**: A `CHANGELOG.md` file is generated with release notes
4. **Git Commit & Tag**: Changes are committed and tagged with the new version
5. **GitHub Release**: A GitHub release is created with the release notes
6. **Docker Image**: Docker images are built and pushed to Docker Hub and GitHub Container Registry

### Commit Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - A new feature (triggers a minor version bump)
- `fix:` - A bug fix (triggers a patch version bump)
- `perf:` - Performance improvements (triggers a patch version bump)
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `BREAKING CHANGE:` - Breaking changes (triggers a major version bump)

Example commits:
```
feat: add support for webhook notifications
fix: resolve authentication issue with Authentik
docs: update installation instructions
```

### Automated Releases

Releases are automatically triggered when commits are pushed to the `main` branch. The GitHub Actions workflow will:

1. Analyze commits since the last release
2. Determine the next version number
3. Update version files
4. Generate/update CHANGELOG.md
5. Create a git tag and GitHub release
6. Build and push Docker images with version tags

### Manual Release (for testing)

To test the release process locally:

```bash
yarn semantic-release --dry-run
```

**Note**: Actual releases require proper authentication tokens set in the CI/CD environment.

## Project Structure

```
├── src/           # TypeScript source files
│   └── index.ts   # Application entry point
├── dist/          # Compiled JavaScript files (generated)
├── tsconfig.json  # TypeScript configuration
└── package.json   # Project dependencies and scripts
```