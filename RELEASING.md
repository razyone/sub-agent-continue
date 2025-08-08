# Automated Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning, changelog generation, and publishing.

## How It Works

### Automatic Releases

1. **Commit Analysis**: semantic-release analyzes commit messages following [Conventional Commits](https://conventionalcommits.org/)
2. **Version Determination**: Automatically determines the next version based on commit types:
   - `fix:` → patch release (e.g., 1.0.0 → 1.0.1)
   - `feat:` → minor release (e.g., 1.0.0 → 1.1.0)  
   - `BREAKING CHANGE:` → major release (e.g., 1.0.0 → 2.0.0)
3. **Changelog Update**: Automatically updates CHANGELOG.md with new release notes
4. **Version Bump**: Updates package.json version
5. **Git Tag**: Creates a git tag for the release
6. **GitHub Release**: Creates a GitHub release with release notes
7. **NPM Publish**: Publishes to npm registry

### Trigger Branches

- **`main`**: Production releases (1.0.0, 1.1.0, etc.)
- **`beta`**: Beta releases (1.0.0-beta.1, 1.0.0-beta.2, etc.)
- **`alpha`**: Alpha releases (1.0.0-alpha.1, 1.0.0-alpha.2, etc.)

## Commit Message Format

Use conventional commit format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Examples

```bash
# Patch release
git commit -m "fix: resolve memory leak in conversation parser"

# Minor release  
git commit -m "feat: add support for custom filter presets"

# Major release
git commit -m "feat!: redesign API for better performance

BREAKING CHANGE: The configuration format has changed. See migration guide."
```

### Commit Types

- `fix:` - Bug fixes (patch)
- `feat:` - New features (minor)
- `docs:` - Documentation changes (no release)
- `style:` - Code formatting (no release)
- `refactor:` - Code refactoring (no release)
- `test:` - Adding tests (no release)
- `chore:` - Maintenance tasks (no release)
- `perf:` - Performance improvements (patch)

## Testing Releases

### Dry Run (Local)

Test what semantic-release would do without making changes:

```bash
npm run release:dry-run
```

### Manual Release

Force a release (use sparingly):

```bash
npm run release
```

## Branch Strategy

### Main Branch Releases

1. Create feature branch from `main`
2. Make changes with conventional commits
3. Create PR to `main`
4. After merge, semantic-release automatically creates release

### Beta Releases

1. Create feature branch from `main`
2. Make changes with conventional commits  
3. Create PR to `beta` branch
4. After merge, semantic-release creates beta release

### Alpha Releases

1. Create feature branch from `main`
2. Make changes with conventional commits
3. Create PR to `alpha` branch
4. After merge, semantic-release creates alpha release

## Migration from Manual Process

✅ **Automated Now:**
- Version bumping
- Changelog generation
- Git tagging
- GitHub releases
- NPM publishing

❌ **No Longer Needed:**
- Manual version updates in package.json
- Manual CHANGELOG.md entries
- Manual git tags
- Manual GitHub releases

## Troubleshooting

### Release Not Triggered

- Ensure commits follow conventional commit format
- Check that commits contain releasable changes (fix:, feat:, etc.)
- Verify GitHub Actions has proper permissions
- Check that GITHUB_TOKEN and NPM_TOKEN secrets are set

### Build Failures

semantic-release runs full CI pipeline before releasing:
- TypeScript compilation
- Linting
- Tests
- Build

Fix any failing steps to enable releases.

## Configuration

Release configuration is in `.releaserc.json`. Key settings:

- **Branches**: Which branches trigger releases
- **Plugins**: Release steps and their order
- **Assets**: Files to commit back (package.json, CHANGELOG.md)