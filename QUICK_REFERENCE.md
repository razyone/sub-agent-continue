# Claudist MCP Quick Reference

## Installation

```bash
# Clone and build
git clone https://github.com/yourusername/claudist-mcp.git
cd claudist-mcp
npm install
npm run build

# Add to Claude Desktop config
# Location: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
```

## Basic Configuration

```json
{
  "mcpServers": {
    "claudist-mcp": {
      "command": "node",
      "args": ["/path/to/claudist-mcp/dist/index.js"],
      "transport": "stdio"
    }
  }
}
```

## Filter Presets

| Preset | Command | Use Case |
|--------|---------|----------|
| None | `"CLAUDIST_FILTER_PRESET": "none"` | Full conversation without filtering |
| Light | `"CLAUDIST_FILTER_PRESET": "light"` | Skip reasoning only |
| Heavy (default) | `"CLAUDIST_FILTER_PRESET": "heavy"` | Skip reasoning and sub-agents |

### What Each Preset Filters:

#### None
- **Filters nothing** - Complete conversation as-is
- Includes all thinking blocks, sub-agents, tools, and messages

#### Light  
- **Filters only:** Thinking/reasoning blocks (`<thinking>` and `<anythingllm:thinking>`)
- **Keeps:** Everything else including sub-agents and their conversations

#### Heavy (Default)
- **Filters:**
  - ✅ Thinking/reasoning blocks
  - ✅ Sub-agent calls (Task tool)
  - ✅ Sub-agent responses (entire nested conversations)
- **Keeps:** All other tools, messages, errors, and system reminders

**Important**: When sub-agents are filtered in 'heavy' mode, their ENTIRE nested conversation is removed, including all tools, messages, and thinking within that sub-agent. This is hierarchical - you get all or nothing for each sub-agent.

## Common Configurations

### For Full Context (Debugging)
```json
{
  "env": {
    "CLAUDIST_FILTER_PRESET": "none"
  }
}
```

### For Minimal Filtering
```json
{
  "env": {
    "CLAUDIST_FILTER_PRESET": "light"
  }
}
```

### Custom Filtering
```json
{
  "env": {
    "CLAUDIST_EXCLUDE_THINKING": "true",
    "CLAUDIST_EXCLUDE_SUBAGENT_CALLS": "true",
    "CLAUDIST_EXCLUDE_SUBAGENT_RESPONSES": "true",
    "CLAUDIST_EXCLUDE_TOOLS": "Edit,Write,MultiEdit",
    "CLAUDIST_MAX_MESSAGE_LENGTH": "5000"
  }
}
```

## Tool Categories

| Category | Tools | Env Variable Value |
|----------|-------|-------------------|
| File Editing | Edit, MultiEdit, Write | `file_edit` |
| File Reading | Read, Glob, Grep, LS | `file_read` |
| Execution | Bash, executeCode | `execution` |
| Web | WebSearch, WebFetch | `web` |
| Analysis | Task (sub-agents) | `analysis` |

## Environment Variables

### Content Filtering
- `CLAUDIST_EXCLUDE_THINKING` - Remove reasoning blocks (default: true)
- `CLAUDIST_EXCLUDE_SYSTEM_REMINDERS` - Remove system reminders (default: false)
- `CLAUDIST_EXCLUDE_ERRORS` - Remove error messages (default: false)
- `CLAUDIST_CUSTOM_PATTERNS` - Comma-separated regex patterns

### Sub-Agent Filtering
- `CLAUDIST_EXCLUDE_SUBAGENT_CALLS` - Remove Task calls (default: true)
- `CLAUDIST_EXCLUDE_SUBAGENT_RESPONSES` - Remove Task responses (default: true)

### Tool Filtering
- `CLAUDIST_EXCLUDE_TOOL_CATEGORIES` - Comma-separated categories
- `CLAUDIST_EXCLUDE_TOOLS` - Comma-separated tool names
- `CLAUDIST_EXCLUDE_TOOL_CALLS_ONLY` - Remove only calls (default: false)
- `CLAUDIST_EXCLUDE_TOOL_RESULTS_ONLY` - Remove only results (default: false)
- `CLAUDIST_EXCLUDE_FAILED_TOOLS` - Remove failed tools (default: false)

### Message Filtering
- `CLAUDIST_MAX_MESSAGE_LENGTH` - Truncate messages (no default)
- `CLAUDIST_EXCLUDE_EMPTY` - Remove empty messages (default: false)
- `CLAUDIST_EXCLUDE_ROLES` - Comma-separated roles to exclude

## API Tools

### getCurrentConversation
```typescript
{
  projectPath?: string,  // Optional, defaults to cwd
  limit?: number        // Optional, default 100, max 1000
}
```

### getCurrentConversationUpto
```typescript
{
  userMessageIndex: number,  // Required, 1-indexed
  projectPath?: string       // Optional, defaults to cwd
}
```

## Token Savings Estimates

| Filter Type | Typical Savings |
|------------|----------------|
| Thinking blocks | 100-500 tokens/block |
| Sub-agent calls | 100-200 tokens/call |
| Sub-agent responses | 500-50,000+ tokens/response |
| File edits | 200-1000 tokens/edit |
| Failed tools | 50-100 tokens/failure |

## Troubleshooting

### Server not starting
```bash
# Check Node version (needs 18+)
node --version

# Verify build
ls -la dist/index.js

# Test directly
node dist/index.js
```

### No conversations found
- Check project path exists in `~/.claude/projects/`
- Ensure conversation files have `.jsonl` extension
- Verify read permissions

### Filtering not working
- Check environment variable names (case-sensitive)
- Verify preset name is valid
- Use `development` preset to see all content

## Performance Tips

1. Use `aggressive` preset for testing/linting agents
2. Use `moderate` for code review agents
3. Keep `minimal` for agents needing context
4. Cache is shared across all calls (1-hour TTL)
5. Filtering happens after cache retrieval

## Example Sub-Agent Configurations

### Test Runner
```json
{"env": {"CLAUDIST_FILTER_PRESET": "aggressive"}}
```

### Code Reviewer
```json
{
  "env": {
    "CLAUDIST_FILTER_PRESET": "moderate",
    "CLAUDIST_EXCLUDE_TOOL_CATEGORIES": "file_edit,web"
  }
}
```

### Documentation Generator
```json
{
  "env": {
    "CLAUDIST_EXCLUDE_THINKING": "true",
    "CLAUDIST_EXCLUDE_SUBAGENT_CALLS": "true",
    "CLAUDIST_EXCLUDE_TOOL_RESULTS_ONLY": "true"
  }
}
```