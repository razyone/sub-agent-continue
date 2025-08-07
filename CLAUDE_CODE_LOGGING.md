# Claude Code Logging Architecture

This document provides a comprehensive analysis of how Claude Code logs conversations, particularly focusing on sub-agent interactions and the structure of conversation files.

## Conversation File Structure

### File Location
Claude Code stores all conversation logs in:
```
~/.claude/projects/{project-name}/
```

Where `{project-name}` is a sanitized version of the project path (e.g., `/Users/name/project` becomes `-Users-name-project`).

### File Format
- **Format**: JSONL (JSON Lines) - one JSON object per line
- **Naming**: UUID-based filenames (e.g., `fe23a5da-3c51-4621-a3e6-8b5b2330c2c4.jsonl`)
- **Encoding**: UTF-8
- **Size**: Can range from a few KB to several MB depending on conversation length

## Message Structure

Each line in a JSONL file represents a single message with this structure:

```json
{
  "parentUuid": "e4ddd473-6f11-4ba7-a893-a0bffe903a34",
  "uuid": "f42c40bb-b5db-466d-9fcc-690cdc4f31e0",
  "timestamp": "2024-08-06T15:45:23.456Z",
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [...]
  },
  "toolUseResult": {...}  // Optional, present when tools are used
}
```

### Field Descriptions

- **parentUuid**: UUID of the previous message in the conversation chain
- **uuid**: Unique identifier for this message
- **timestamp**: ISO 8601 timestamp of when the message was created
- **type**: Either "user" or "assistant"
- **message**: The actual message content following the Claude API format
- **toolUseResult**: Optional field containing tool execution results and metrics

## Sub-Agent Logging Behavior

### Key Discovery: Inline Logging

Sub-agents spawned via the Task tool **do not create separate conversation files**. Instead, their interactions are logged inline within the parent conversation file.

### Sub-Agent Spawn Pattern

When a sub-agent is spawned, the logging follows this pattern:

#### 1. Task Tool Invocation (Assistant Message)
```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "tool_use",
      "id": "toolu_01AoADqrFr9SejxinbM28s6c",
      "name": "Task",
      "input": {
        "description": "Read core architecture documents",
        "prompt": "Read and provide a brief summary of the following files...",
        "subagent_type": "general-purpose"
      }
    }]
  }
}
```

#### 2. Sub-Agent Response (User Message with Tool Result)
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01AoADqrFr9SejxinbM28s6c",
      "type": "tool_result",
      "content": [{
        "type": "text",
        "text": "## Summary\n\n### 1. Overall Project Architecture..."
      }]
    }]
  },
  "toolUseResult": {
    "content": [...],
    "totalDurationMs": 22310,
    "totalTokens": 34580,
    "totalToolUseCount": 2,
    "usage": {
      "input_tokens": 8,
      "cache_creation_input_tokens": 16578,
      "cache_read_input_tokens": 17304,
      "output_tokens": 690,
      "service_tier": "standard"
    }
  }
}
```

### Performance Metrics Captured

For each sub-agent invocation, Claude Code captures:

- **totalDurationMs**: Total execution time in milliseconds
- **totalTokens**: Total tokens used by the sub-agent
- **totalToolUseCount**: Number of tools the sub-agent used
- **usage**: Detailed token breakdown including:
  - `input_tokens`: Direct input tokens
  - `cache_creation_input_tokens`: Tokens used to create cache
  - `cache_read_input_tokens`: Tokens read from cache
  - `output_tokens`: Generated output tokens
  - `service_tier`: Model tier used (e.g., "standard")

## Tool Usage Logging

### Standard Tool Pattern

Regular tools (Read, Write, Bash, etc.) follow this pattern:

```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_xyz",
      "name": "Read",
      "input": {
        "file_path": "/path/to/file.ts"
      }
    }]
  }
}
```

Followed by the result:

```json
{
  "type": "user",
  "message": {
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_xyz",
      "content": "File contents here..."
    }]
  }
}
```

### Error Handling

Failed or interrupted tool uses are logged with error flags:

```json
{
  "type": "tool_result",
  "content": "[Request interrupted by user for tool use]",
  "is_error": true,
  "tool_use_id": "toolu_01WKKXDYuEPRezLSs4n91att"
}
```

## Implications for Sub-Agents

### The "Blank Slate" Problem

1. **No Context Transfer**: Sub-agents start with zero knowledge of the parent conversation
2. **Redundant Operations**: Sub-agents must re-read files and re-analyze code
3. **Token Inefficiency**: Repeated discovery work increases token usage
4. **Potential Inconsistencies**: Sub-agents may make different decisions than the parent

### Why Inline Logging Matters

The inline logging approach means:

1. **Complete History**: The entire conversation, including sub-agent work, is in one file
2. **Linear Timeline**: Events are logged chronologically in execution order
3. **No Cross-References**: No need to correlate multiple files
4. **Performance Visibility**: Parent agent can see sub-agent metrics

## Conversation Lifecycle

### Session Creation
1. New JSONL file created with UUID filename
2. First message logged with null parentUuid
3. Subsequent messages chain via parentUuid references

### Message Flow
```
User Message 1
  └→ Assistant Message 1
      └→ User Message 2 (may contain tool results)
          └→ Assistant Message 2
              └→ Task Tool Use (spawns sub-agent)
                  └→ User Message 3 (contains sub-agent response)
                      └→ Assistant Message 3 (continues main flow)
```

### Session Termination
- File remains in project directory
- No explicit close/termination marker
- New conversations create new files

## File Management

### Storage Patterns
- Multiple conversation files per project (different sessions)
- Files ordered by creation time
- No automatic cleanup or archival
- Files persist indefinitely unless manually deleted

### File Sizes
- Small conversations: ~5-50 KB
- Medium conversations: 100-500 KB  
- Large conversations with many tool uses: 1-5 MB
- Very large conversations: 5+ MB

## Best Practices for MCP Servers

Based on this logging architecture, MCP servers should:

1. **Parse JSONL Efficiently**: Use streaming parsers for large files
2. **Handle Inline Sub-Agents**: Recognize Task tool patterns
3. **Cache Parsed Data**: Avoid re-parsing large conversation files
4. **Index by Message Type**: Enable quick filtering of user vs assistant messages
5. **Track Token Usage**: Sum tokens across sub-agent invocations

## Security Considerations

### Sensitive Data in Logs
- Tool inputs/outputs are logged verbatim
- File contents are stored in full
- API keys or secrets in code may be captured
- No automatic redaction or filtering

### Access Control
- Files are stored with user permissions
- No encryption at rest
- Full conversation history accessible to any process with file access

## Future Considerations

### Potential Improvements
1. **Separate Sub-Agent Files**: Could reduce main file size
2. **Compression**: JSONL files compress well with gzip
3. **Incremental Updates**: Append-only nature allows streaming
4. **Metadata Indexes**: Could speed up conversation search
5. **Automatic Archival**: Old conversations could be compressed/archived

### Challenges
1. **Growing File Sizes**: Long conversations become unwieldy
2. **Memory Usage**: Parsing entire files requires significant RAM
3. **Search Performance**: No built-in indexing for content search
4. **Cross-Session Context**: No easy way to reference other conversations

## Conclusion

Claude Code's logging architecture prioritizes simplicity and completeness over optimization. The inline logging of sub-agents creates opportunities for tools like Claudist MCP to provide context to sub-agents, significantly improving their effectiveness and reducing redundant work.

The append-only JSONL format makes the logs easy to parse and process, while the complete capture of all tool uses and responses ensures full visibility into the conversation flow. Understanding this architecture is crucial for building effective MCP servers and tools that interact with Claude Code's conversation history.