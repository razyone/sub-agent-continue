# Filtering Logic Documentation

This document explains Claudist MCP's comprehensive filtering system, including how it differentiates between regular tools and sub-agents, and the various filtering options available.

## Key Differences: Regular Tools vs Sub-Agent (Task) Tool

### Regular Tool Call (e.g., Read, Write, Bash)

**Assistant message with tool call:**
```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_xyz",
      "name": "Read",  // Regular tool name
      "input": {
        "file_path": "/path/to/file.ts"
      }
    }]
  }
}
```

**User message with tool result:**
```json
{
  "type": "user",
  "message": {
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_xyz",
      "content": "File contents here..."
    }]
  },
  "toolUseResult": "File contents here..."  // Simple string for regular tools
}
```

### Sub-Agent Call (Task Tool)

**Assistant message with Task tool call:**
```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_abc",
      "name": "Task",  // Special Task tool
      "input": {
        "description": "Analyze code",
        "prompt": "Please analyze...",
        "subagent_type": "general-purpose"
      }
    }]
  }
}
```

**User message with sub-agent response:**
```json
{
  "type": "user",
  "message": {
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_abc",
      "content": "Sub-agent's complete response..."
    }]
  },
  "toolUseResult": {
    // These fields are UNIQUE to sub-agent responses:
    "totalDurationMs": 22310,      // Execution time
    "totalTokens": 34580,          // Total tokens used
    "totalToolUseCount": 2,        // Tools used by sub-agent
    "usage": {                     // Detailed token breakdown
      "input_tokens": 8,
      "cache_creation_input_tokens": 16578,
      "cache_read_input_tokens": 17304,
      "output_tokens": 690
    }
  }
}
```

## Detection Logic

### 1. Detecting Sub-Agent Calls

```typescript
function isSubAgentCall(entry: ConversationEntry): boolean {
  // 1. Must be an assistant message
  if (entry.type !== 'assistant') return false;
  
  // 2. Check if any tool_use has name === 'Task'
  const content = entry.message.content;
  if (Array.isArray(content)) {
    return content.some(item => 
      item.type === 'tool_use' && 
      item.name === 'Task'
    );
  }
  
  return false;
}
```

### 2. Detecting Sub-Agent Responses

```typescript
function isSubAgentResponse(entry: ConversationEntry): boolean {
  // 1. Must be a user message
  if (entry.type !== 'user') return false;
  
  // 2. Check for unique sub-agent performance metrics
  if (entry.toolUseResult) {
    const result = entry.toolUseResult;
    
    // These three fields ONLY appear in sub-agent responses
    return !!(
      result.totalDurationMs &&     // Sub-agent execution time
      result.totalTokens &&          // Sub-agent token usage
      typeof result.totalToolUseCount === 'number'  // Sub-agent tool count
    );
  }
  
  return false;
}
```

## Why This Works

### Key Difference:
- **Regular tools**: `toolUseResult` is a simple **string**
- **Sub-agents**: `toolUseResult` is an **object** with performance metrics

### Hierarchical Filtering

When a sub-agent is filtered out, **everything inside it is automatically removed**:

```
Parent Conversation
├── User message
├── Assistant message (with Task tool call) ← If filtered
├── User message (with sub-agent response) ← This entire block is removed
│   └── Contains:
│       ├── Sub-agent's user messages
│       ├── Sub-agent's assistant messages  
│       ├── Sub-agent's tool calls (Read, Write, etc.)
│       ├── Sub-agent's tool results
│       └── Sub-agent's thinking/reasoning
└── Assistant continues...
```

**This means**: When `excludeSubAgentResponses: true`, you automatically filter out:
- All of the sub-agent's conversation
- All of the sub-agent's tool usage
- All of the sub-agent's thinking
- Everything that happened inside that sub-agent

**No need for redundant filtering**: If you're already filtering sub-agents, you don't need to separately worry about filtering tools that only appear within sub-agents.

### Regular Tools Never Have:
- `totalDurationMs` - Regular tools don't track execution time this way
- `totalTokens` - Regular tools don't use tokens (they're system functions)
- `totalToolUseCount` - Regular tools don't spawn other tools

### Only Sub-Agents Have:
- Performance metrics because they're separate LLM invocations
- Token usage because they consume API resources
- Tool counts because they can use tools themselves
- Complete nested conversations within their response

## Examples of What Gets Filtered

### When `excludeSubAgentCalls: true`:
Removes assistant messages that contain:
```
"name": "Task"
```

### When `excludeSubAgentResponses: true`:
Removes user messages that contain:
```
"toolUseResult": {
  "totalDurationMs": ...,
  "totalTokens": ...,
  "totalToolUseCount": ...
}
```

### Regular Tool Usage (NOT filtered):
- Read file operations
- Write file operations
- Bash commands
- Grep searches
- Web searches
- Any other non-Task tools

## Comprehensive Filtering Options

### Filter Presets

Claudist MCP provides four preset configurations:

| Preset | Description | Use Case |
|--------|-------------|----------|
| `smart` (default) | Optimized filtering for sub-agent needs | Best for most sub-agents |
| `minimal` | Removes thinking & sub-agents only | When you need more context |
| `moderate` | Balanced filtering | Medium token savings |
| `aggressive` | Maximum filtering, minimal context | Maximum token savings |
| `development` | No filtering | Debugging and analysis |

### Smart Preset Details (Default)

The `smart` preset is specifically designed for sub-agent context needs:

**What it removes (not useful for sub-agents):**
- Thinking/reasoning blocks - Implementation details sub-agents don't need
- System reminders - UI notifications irrelevant to sub-agents
- Other sub-agent spawning and responses - Parallel work that doesn't affect this agent
- File edit operations - The mechanics of how files were changed
- Failed tool attempts - Dead ends that don't help
- Project management tools - TodoWrite, ExitPlanMode not needed
- Tool results - Keeps the intent (tool call) but removes bulky results
- Empty messages - Pure noise
- Very long messages - Truncated at 10,000 characters

**What it keeps (essential context):**
- User messages - What was requested
- Assistant decisions - What was decided and why
- File read operations - What code was examined
- Execution results - What commands were run
- Errors - What went wrong (important context)
- Tool calls - Shows intent even without results

### Configuration Options

#### 1. Content Filtering
```bash
CLAUDIST_EXCLUDE_THINKING=true           # Remove <thinking> blocks
CLAUDIST_EXCLUDE_SYSTEM_REMINDERS=false  # Keep <system-reminder> blocks
CLAUDIST_EXCLUDE_ERRORS=false           # Keep error messages
CLAUDIST_CUSTOM_PATTERNS="pattern1,pattern2"  # Custom regex patterns
```

#### 2. Sub-Agent Filtering
```bash
CLAUDIST_EXCLUDE_SUBAGENT_CALLS=true     # Remove Task tool calls
CLAUDIST_EXCLUDE_SUBAGENT_RESPONSES=true # Remove sub-agent responses
```

#### 3. Tool Filtering
```bash
CLAUDIST_EXCLUDE_TOOL_CATEGORIES=file_edit,web  # Remove categories
CLAUDIST_EXCLUDE_TOOLS=Edit,Write,WebSearch     # Remove specific tools
CLAUDIST_EXCLUDE_TOOL_CALLS_ONLY=false         # Keep results
CLAUDIST_EXCLUDE_TOOL_RESULTS_ONLY=false       # Keep calls
CLAUDIST_EXCLUDE_FAILED_TOOLS=true             # Remove failed tools
```

#### 4. Message Filtering
```bash
CLAUDIST_MAX_MESSAGE_LENGTH=5000         # Truncate long messages
CLAUDIST_EXCLUDE_EMPTY=true              # Remove empty messages
CLAUDIST_EXCLUDE_ROLES=system            # Exclude by role
```

### Tool Categories

| Category | Tools Included | Purpose |
|----------|---------------|---------|
| `file_edit` | Edit, MultiEdit, Write, NotebookEdit | File modification operations |
| `file_read` | Read, Glob, Grep, LS | File reading operations |
| `execution` | Bash, executeCode | Code/command execution |
| `web` | WebSearch, WebFetch | Web interactions |
| `analysis` | Task | Sub-agent spawning |
| `project` | Git operations, TodoWrite | Project management |
| `mcp` | MCP-specific tools | MCP protocol tools |

## Token Savings

By filtering sub-agents by default:
- **Task tool calls**: Save ~100-200 tokens per call
- **Sub-agent responses**: Save 500-50,000+ tokens per response
- **Typical savings**: 60-80% token reduction in conversations with multiple sub-agents

## Edge Cases

1. **Interrupted sub-agents**: Still filtered (they have the performance metrics even if incomplete)
2. **Failed sub-agents**: Still filtered (error responses still have the metrics)
3. **Multiple sub-agents**: Each is individually filtered
4. **Nested sub-agents**: Parent's view of child sub-agents is already inline, so filtering works correctly