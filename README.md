# Claudist MCP

An MCP (Model Context Protocol) server that provides access to Claude Code conversation history, solving the "blank slate" problem when sub-agents are spawned.

## Overview

**Claudist MCP** is a Model Context Protocol server designed to solve the "blank slate" problem when Claude Code spawns sub-agents. By providing access to conversation history from Claude Code sessions, sub-agents can understand prior context, decisions, and work completed before their initialization.

### How Sub-Agents Work in Claude Code

When Claude Code spawns a sub-agent via the Task tool:
1. The sub-agent starts with no knowledge of the parent conversation
2. The sub-agent's complete response is logged inline in the parent's conversation file
3. The parent agent receives the sub-agent's output as a tool result
4. Performance metrics (tokens, duration, tool usage) are captured for each sub-agent

#### Conversation Hierarchy

```
Parent Conversation
├── User: "Build a TODO app"
├── Assistant: "I'll analyze the requirements..."
├── Assistant: [Task Tool] "Research TODO app patterns"
├── User: [Sub-Agent Response - 10,000+ tokens]
│   └── Contains ENTIRE sub-agent conversation:
│       ├── All messages between sub-agent and its context
│       ├── All tool calls (Read, Write, Bash, etc.)
│       ├── All tool results
│       ├── All thinking/reasoning
│       └── Final response
├── Assistant: "Based on the research..."
└── ... conversation continues
```

**Key Insight**: When Claudist MCP filters out sub-agents, it removes the entire nested conversation block, automatically eliminating all tools and messages within that sub-agent.

This creates a "blank slate" problem where sub-agents must rediscover context, leading to:
- Redundant file reads and analysis
- Increased token usage
- Potential inconsistencies with parent agent's decisions

## 📚 Documentation

- 📖 **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick setup and configuration guide
- 📖 **[CLAUDE_CODE_LOGGING.md](CLAUDE_CODE_LOGGING.md)** - Claude Code's logging architecture
- 📖 **[FILTERING_LOGIC.md](FILTERING_LOGIC.md)** - Comprehensive filtering system documentation
- 📖 **[CHANGELOG.md](CHANGELOG.md)** - Version history and feature updates

## Filter Presets

Claudist MCP offers 3 simple presets for filtering conversation history:

- **`none`** - No filtering, complete conversation as-is
- **`light`** - Skip only reasoning/thinking blocks
- **`heavy`** (default) - Skip reasoning and sub-agents (removes entire sub-agent conversations)

Set via environment variable: `CLAUDIST_FILTER_PRESET=light`

## Purpose

### Problem Statement

When Claude Code creates sub-agents via the Task tool, these agents start without any knowledge of:

- Previous discussions and decisions
- Code already examined or modified
- User preferences and requirements established earlier
- Context about the current project state

### Solution

Claudist MCP exposes Claude Code conversation history stored in `~/.claude/projects/` as structured XML. Since sub-agent responses are logged inline with the parent conversation, Claudist MCP allows sub-agents to:

- Retrieve conversation context up to their spawn point
- Understand prior work to avoid redundancy
- Maintain consistency with earlier decisions
- Continue seamlessly from where the parent agent left off

## Use Cases

### 1. **Sub-agent Context Initialization**

When a sub-agent is spawned to handle a complex task, it can query the conversation history to understand:

- What the user originally requested
- What approaches have been discussed
- What code has been examined
- What decisions were made and why

### 2. **Multi-step Task Coordination**

For tasks spanning multiple agents:

- Agent A explores the codebase and identifies issues
- Agent B (spawned later) retrieves Agent A's findings
- Agent B continues work without re-exploring

### 3. **Conversation Continuity**

- Maintain context across agent boundaries
- Preserve user preferences and coding style decisions
- Ensure consistent approaches throughout the session

### 4. **Debugging and Analysis**

- Review conversation flow and tool usage
- Analyze decision-making patterns
- Debug issues by examining full context

## Requirements

### System Requirements

- Node.js 18+ or Bun runtime
- Access to `~/.claude/projects/` directory
- MCP-compatible client (Claude Code)

### Dependencies

- MCP SDK for server implementation
- File system access for reading JSONL files
- JSON parsing capabilities
- XML generation libraries (optional, can use template strings)

## Installation

### Option 1: Local Installation

Clone and build the server:

```bash
# Clone the repository
git clone https://github.com/razyone/claudist-mcp.git
cd claudist-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

Add to Claude Desktop configuration:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claudist-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/claudist-mcp/dist/index.js"],
      "transport": "stdio"
    }
  }
}
```

### Option 2: Direct Usage with npx

Add to Claude Desktop configuration without local installation:

```json
{
  "mcpServers": {
    "claudist-mcp": {
      "command": "npx",
      "args": ["claudist-mcp"],
      "transport": "stdio"
    }
  }
}
```

After updating the configuration, restart Claude Desktop for the changes to take effect.

### Configuration with Environment Variables

#### Quick Setup with Presets

Use filtering presets for common scenarios:

```json
{
  "mcpServers": {
    "claudist-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/claudist-mcp/dist/index.js"],
      "transport": "stdio",
      "env": {
        "CLAUDIST_FILTER_PRESET": "smart"  // Options: smart (default), minimal, moderate, aggressive, development
      }
    }
  }
}
```

#### Detailed Configuration

Fine-grained control over filtering:

```json
{
  "mcpServers": {
    "claudist-mcp": {
      "command": "node", 
      "args": ["/absolute/path/to/claudist-mcp/dist/index.js"],
      "transport": "stdio",
      "env": {
        // Content filtering
        "CLAUDIST_EXCLUDE_THINKING": "true",              // Remove reasoning blocks
        "CLAUDIST_EXCLUDE_SYSTEM_REMINDERS": "false",     // Keep system reminders
        "CLAUDIST_EXCLUDE_ERRORS": "false",               // Keep error messages
        
        // Sub-agent filtering  
        "CLAUDIST_EXCLUDE_SUBAGENT_CALLS": "true",        // Remove Task tool calls
        "CLAUDIST_EXCLUDE_SUBAGENT_RESPONSES": "true",    // Remove sub-agent responses
        
        // Tool filtering
        "CLAUDIST_EXCLUDE_TOOL_CATEGORIES": "file_edit",  // Remove Edit, Write, MultiEdit
        "CLAUDIST_EXCLUDE_TOOLS": "WebSearch,WebFetch",   // Remove specific tools
        "CLAUDIST_EXCLUDE_FAILED_TOOLS": "true",          // Remove failed tool uses
        
        // Message filtering
        "CLAUDIST_MAX_MESSAGE_LENGTH": "5000",            // Truncate long messages
        "CLAUDIST_EXCLUDE_EMPTY": "true"                  // Remove empty messages
      }
    }
  }
}
```

#### Filter Presets

- **`smart`** (default): Optimized for sub-agents - removes thinking, sub-agents, file edits, failed tools, system reminders, but keeps intent and errors
- **`minimal`**: Removes only thinking & sub-agents 
- **`moderate`**: Balance between context and size
- **`aggressive`**: Maximum filtering, minimal context
- **`development`**: No filtering, see everything

#### Tool Categories

- `file_edit`: Edit, MultiEdit, Write, NotebookEdit
- `file_read`: Read, Glob, Grep, LS  
- `execution`: Bash, code execution
- `web`: WebSearch, WebFetch
- `analysis`: Task (sub-agents)
- `project`: Git operations, TodoWrite

## Available Tools

### 1. getCurrentConversation

Get the current conversation messages from a Claude Code project.

**Parameters:**

- `projectPath` (optional): Project path to get conversation from (defaults to current directory)
- `limit` (optional): Maximum number of recent messages to return (default: 100)

### 2. getCurrentConversationUpto

Get conversation messages up to (but not including) the nth user message, counting from the start of the conversation.

**Parameters:**

- `userMessageIndex` (required): Get messages up to this user message number (1-indexed from conversation start)
- `projectPath` (optional): Project path to get conversation from

## Project Structure

```
claudist-mcp/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # MCP server setup
│   ├── tools/                # Tool implementations
│   ├── lib/                  # Core functionality
│   │   ├── filter.ts        # Advanced filtering system
│   │   ├── filter-config.ts # Filter configuration & presets
│   │   └── ...              # Other utilities
│   └── types/                # TypeScript types
├── tests/
├── CLAUDE_CODE_LOGGING.md   # Detailed Claude Code logging documentation
├── FILTERING_LOGIC.md       # Comprehensive filtering documentation
├── package.json
├── tsconfig.json
└── biome.jsonc               # Formatter configuration
```

## Current Features

- **Comprehensive filtering system**:
  - **Content filtering**: Removes thinking blocks, system reminders, custom patterns
  - **Tool filtering**: By category (file_edit, web, etc.) or specific tool names
  - **Sub-agent filtering**: Removes Task calls and responses by default
  - **Message filtering**: Truncation, empty message removal, role-based filtering
  - **Preset configurations**: smart (default), minimal, moderate, aggressive, development
- **Smart defaults**: 'smart' preset optimized for sub-agent context needs
- **LRU cache** with 1-hour TTL for parsed conversation files (100 file capacity)
- **User message indexing** from conversation start (1-indexed)
- **Empty response handling** returns empty XML when conversations don't exist
- **Error handling** returns structured error XML for failures

## Future Enhancements

### Planned Features

1. **Advanced Filtering**
   - Redact sensitive information (API keys, secrets)
   - Configurable maximum message length
   - Custom regex-based content filtering
   - Tool-specific filtering (e.g., exclude only certain tools)

2. **Advanced Retrieval**
   - Get conversation from specific timestamp
   - Filter by message type (user/assistant/tool)
   - Search within conversation content
   - Get conversation statistics/metadata only

3. **Performance Optimizations**
   - Configurable cache size and TTL
   - Streaming large conversations
   - Pagination support for very long conversations

## Security Considerations

1. **Access Control**
   - Only expose conversations from allowed project paths
   - Validate session IDs to prevent unauthorized access
   - Sanitize file paths to prevent directory traversal

2. **Privacy**
   - Future: Option to exclude sensitive tool results
   - Future: Filter out API keys and secrets
   - Future: Configurable content redaction

3. **Resource Limits**
   - Limit conversation size in responses
   - Implement request rate limiting
   - Memory usage caps for caching (currently 100 files)

## Example Usage

### Configuration Examples

#### For Testing/Linting Sub-Agents (Minimal Context)
```json
{
  "env": {
    "CLAUDIST_FILTER_PRESET": "aggressive"  // Maximum filtering
  }
}
```

#### For Code Analysis Sub-Agents (Need File Context)
```json
{
  "env": {
    "CLAUDIST_FILTER_PRESET": "moderate",
    "CLAUDIST_EXCLUDE_TOOL_CATEGORIES": "file_edit"  // Keep reads, remove edits
  }
}
```

#### For Debugging Issues
```json
{
  "env": {
    "CLAUDIST_FILTER_PRESET": "development"  // See everything
  }
}
```

### API Usage

#### Getting current conversation:
```typescript
const current = await mcp.call("getCurrentConversation", {
  projectPath: "/Users/name/project",
  limit: 50  // Last 50 messages after filtering
});
```

#### Getting context up to specific point:
```typescript
const context = await mcp.call("getCurrentConversationUpto", {
  userMessageIndex: 5,  // Up to 5th user message
  projectPath: "/Users/name/project"
});
```

## Development

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

## Git Workflow

This project uses Husky for git hooks and Commitlint for conventional commits.

### Pre-commit Hook

Automatically runs:

- Code formatting via lint-staged
- Linting on staged files
- Test suite

### Commit Message Format

Follow the conventional commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI/CD changes
- `chore`: Other changes that don't modify src or test files

**Examples:**

```bash
git commit -m "feat: add getConversationMetadata tool"
git commit -m "fix: handle empty conversation files gracefully"
git commit -m "docs: update installation instructions"
git commit -m "refactor: simplify XML generation logic"
```

## License

MIT
