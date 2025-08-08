# Sub Agent Continue MCP

[![CI](https://github.com/razyone/sub-agent-continue/workflows/CI/badge.svg)](https://github.com/razyone/sub-agent-continue/actions)
[![npm version](https://badge.fury.io/js/sub-agent-continue.svg)](https://www.npmjs.com/package/sub-agent-continue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/sub-agent-continue.svg)](https://nodejs.org/)

An MCP server that provides Claude Code sub-agents with conversation context, solving the "blank slate" problem where sub-agents start with zero knowledge of previous discussions.

## ⚠️ Important: For Sub-Agents Only

This MCP server provides tools that are **only useful for sub-agents**. The main Claude Code instance doesn't need these tools since it already has full conversation context.

**When these tools are useful:**
- ✅ Sub-agents that need access to conversation history
- ❌ Main Claude Code instance (it already has full context)

## Installation

### Requirements
- Node.js 18 or higher

```bash
git clone https://github.com/razyone/sub-agent-continue.git
cd sub-agent-continue
npm install && npm run build
```

Add to your Claude configuration:
```json
{
  "mcpServers": {
    "sub-agent-continue": {
      "command": "node",
      "args": ["/absolute/path/to/sub-agent-continue/dist/index.js"],
      "transport": "stdio"
    }
  }
}
```

For detailed configuration instructions, see [Installing MCP Servers](https://docs.anthropic.com/en/docs/claude-code/mcp#installing-mcp-servers).

## Tools

### getCurrentConversation

Get current conversation history (excludes the last user message to avoid sub-agents seeing their trigger).

**Parameters:**
- `projectPath` (optional): Project path, defaults to current directory
- `filterPreset` (optional): Filter level - `none`, `light`, or `heavy` (default)

**Best for:** Sub-agents continuing ongoing work like linting, fixing, refactoring.

### getCurrentConversationUpto  

Get conversation history up to a specific user message.

**Parameters:**
- `userMessageIndex` (required): User message number (1-indexed)
- `projectPath` (optional): Project path, defaults to current directory  
- `filterPreset` (optional): Filter level - `none`, `light`, or `heavy` (default)

**Best for:** Development phases (planning, testing, reviewing) or debugging conversation flow.

## Filter Presets

- **`none`** - Complete conversation history
- **`light`** - Remove reasoning blocks (`<thinking>`)
- **`heavy`** (default) - Remove reasoning blocks and sub-agent interactions for cost efficiency

## Usage Example

```json
{
  "tool": "getCurrentConversation",
  "parameters": {
    "projectPath": "/path/to/project",
    "filterPreset": "heavy"
  }
}
```

## Development

```bash
npm test        # Run tests
npm run lint    # Lint code  
npm run build   # Build for production
```

## License

MIT