# 1.0.0-beta.1 (2025-08-09)


### Bug Fixes

* increase commit-lint line length limits from 100 to 200 characters ([#9](https://github.com/razyone/sub-agent-continue/issues/9)) ([618d3c4](https://github.com/razyone/sub-agent-continue/commit/618d3c4086faf71cd8b6f637f933f0462e53c782))
* remove persist-credentials option in release workflow ([#14](https://github.com/razyone/sub-agent-continue/issues/14)) ([90d8c21](https://github.com/razyone/sub-agent-continue/commit/90d8c212aedcf4731a33fad2104ad62f995c9b70))
* update git user configuration in release workflow for GPG signing ([#12](https://github.com/razyone/sub-agent-continue/issues/12)) ([0a82d35](https://github.com/razyone/sub-agent-continue/commit/0a82d3594d7879cb2a9e004df36d6c009d8cbc36))
* update GPG key configuration in release workflow ([bc02de8](https://github.com/razyone/sub-agent-continue/commit/bc02de862e33672e545f55b58d88c90a37c9539c))
* update release message format in .releaserc.json to remove changelog notes ([#10](https://github.com/razyone/sub-agent-continue/issues/10)) ([f2bc0f0](https://github.com/razyone/sub-agent-continue/commit/f2bc0f0751971b0c7e7b00d09a6ff4b065e42f55))
* upgrade Node.js from 18 to 20 in workflows for semantic-release … ([#4](https://github.com/razyone/sub-agent-continue/issues/4)) ([33c6f06](https://github.com/razyone/sub-agent-continue/commit/33c6f0613f1ba2c3a92bec4515f634fa9fc7dfa4))


### Features

* add GPG signing support to semantic-release ([#11](https://github.com/razyone/sub-agent-continue/issues/11)) ([6e35d06](https://github.com/razyone/sub-agent-continue/commit/6e35d065790fddb96a5031667f9ef449beab989b))
* configure semantic-release with proper branch strategy ([#8](https://github.com/razyone/sub-agent-continue/issues/8)) ([6019ba6](https://github.com/razyone/sub-agent-continue/commit/6019ba6fee1b8abd9a6f9ba14d33b59b997c5905))
* initial MCP server implementation for Claude Code conversations ([0cab00d](https://github.com/razyone/sub-agent-continue/commit/0cab00d9a82d77bc6425e10d725bdb4af08c317b))
* Sub Agent Continue MCP server for Claude Code conversation context ([f9c1d97](https://github.com/razyone/sub-agent-continue/commit/f9c1d97c39e17819e770e11639fbb82f15c9d96a))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.1] - 2025-01-08

### Added
- Initial alpha release of Sub Agent Continue MCP server
- Core MCP server implementation enabling sub-agents to continue with parent agent context
- Two primary tools:
  - `getCurrentConversation`: Retrieve current conversation with filtering
  - `getCurrentConversationUpto`: Retrieve conversation up to a specific user message
- Filter presets are specified as tool parameters (no environment variable support)
- Eight filter presets: none, light, heavy (default), smart, minimal, moderate, aggressive, development
- Advanced filtering options:
  - Skip tool calls by type
  - Skip sub-agent messages
  - Skip reasoning/thinking blocks
  - Remove XML tags
  - Limit conversation depth
- LRU cache for improved performance
- Comprehensive test suite with 227 tests
- Security features:
  - Path validation to prevent directory traversal
  - File size limits (100MB max)
  - Input sanitization
- Rate limiting to prevent abuse
- Graceful shutdown handling
- TypeScript support with full type definitions
- Documentation:
  - Quick reference guide
  - Claude Code logging architecture
  - Filtering logic documentation

### Security
- Added path validation to ensure files are only read from ~/.claude directory
- Added file size validation to prevent memory exhaustion
- Added input sanitization for project paths
- Added rate limiting to prevent request flooding

### Performance
- Implemented LRU cache for parsed conversations
- Added performance monitoring with timing metrics
- Optimized XML parsing and filtering

### Testing
- 87.45% code coverage
- Unit tests for all core functionality
- Tests for real-world conversation logs

### Known Issues
- Server startup logging goes to stderr (by design for MCP protocol)
- Cache size is not configurable via environment variables (planned for future release)

## [1.0.0-beta.2] - 2025-01-08

### Added
- Comprehensive "How It Works" section explaining both getCurrentConversation tools
- Key benefits documentation: context inheritance, cost savings, clean context management  
- Specific use cases: lint-agents, planning-agents, side tasks
- Sample sub-agent creation prompt template for users

### Changed
- Enhanced README with sub-agent workflow explanation and usage examples

## [Unreleased]

### Planned
- Configurable cache size via environment variables
- Streaming support for very large conversation files
- Additional filter presets for common use cases
- Web UI for testing and debugging
- Support for multiple conversation formats
- Conversation search and query capabilities
