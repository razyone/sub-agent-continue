import type { ConversationEntry, MessageContent } from '../types/index.js';

export function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTextItem(item: Record<string, unknown>): string {
  if (item.text) {
    return escapeXML(String(item.text));
  }
  return '';
}

function formatToolUseItem(item: Record<string, unknown>): string {
  const name = item.name ? String(item.name) : '';
  const id = item.id ? String(item.id) : '';
  const input = item.input ? JSON.stringify(item.input) : '';
  return `<tool_use name="${escapeXML(name)}" id="${escapeXML(id)}">${input}</tool_use>`;
}

function formatToolResultItem(item: Record<string, unknown>): string {
  const toolUseId = item.tool_use_id ? String(item.tool_use_id) : '';
  const content = item.content ? JSON.stringify(item.content) : '';
  return `<tool_result id="${escapeXML(toolUseId)}">${content}</tool_result>`;
}

function formatContentItem(item: unknown): string {
  if (typeof item === 'string') {
    return escapeXML(item);
  }

  if (typeof item !== 'object' || item === null || !('type' in item)) {
    return '';
  }

  const typedItem = item as Record<string, unknown>;
  const itemType = String(typedItem.type);

  switch (itemType) {
    case 'text':
      return formatTextItem(typedItem);
    case 'tool_use':
      return formatToolUseItem(typedItem);
    case 'tool_result':
      return formatToolResultItem(typedItem);
    default:
      return '';
  }
}

export function formatContent(content: MessageContent): string {
  if (typeof content === 'string') {
    return escapeXML(content);
  }

  if (Array.isArray(content)) {
    return content.map(formatContentItem).filter(Boolean).join('\n');
  }

  // Handle object with text or content property
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;
    if ('text' in obj && typeof obj.text === 'string') {
      return escapeXML(obj.text);
    }
    if ('content' in obj && typeof obj.content === 'string') {
      return escapeXML(obj.content);
    }
  }

  return JSON.stringify(content);
}

export function formatToolResult(toolResult: unknown): string {
  if (!toolResult) {
    return '';
  }

  const jsonStr = JSON.stringify(toolResult);
  // Don't escape JSON - it should be readable as JSON
  return `
    <tool_result>
      ${jsonStr}
    </tool_result>`;
}

export function formatMessage(entry: ConversationEntry): string {
  const contentStr = formatContent(entry.message.content);
  const toolResultStr = entry.toolUseResult
    ? formatToolResult(entry.toolUseResult)
    : '';

  return `
    <message uuid="${escapeXML(entry.uuid)}" timestamp="${escapeXML(entry.timestamp)}">
      <role>${escapeXML(entry.message.role)}</role>
      <type>${escapeXML(entry.type)}</type>
      <content>${contentStr}</content>${toolResultStr}
    </message>`;
}

export function toXML(
  entries: ConversationEntry[],
  metadata?: {
    sessionId?: string;
    projectPath?: string;
  }
): string {
  const messages = entries.map(formatMessage).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<conversation>
  <metadata>
    ${metadata?.sessionId ? `<session_id>${escapeXML(metadata.sessionId)}</session_id>` : ''}
    ${
      metadata?.projectPath
        ? `<project_path>${escapeXML(metadata.projectPath)}</project_path>`
        : ''
    }
    <message_count>${entries.length}</message_count>
    ${entries.length > 0 ? `<first_message_time>${escapeXML(entries[0]?.timestamp || '')}</first_message_time>` : ''}
    ${
      entries.length > 0
        ? `<last_message_time>${escapeXML(entries.at(-1)?.timestamp || '')}</last_message_time>`
        : ''
    }
  </metadata>
  <messages>${messages}
  </messages>
</conversation>`;
}

export function createErrorXML(error: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<error>
  <message>${escapeXML(error)}</message>
</error>`;
}

export function createEmptyConversationXML(reason?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<conversation>
  <metadata>
    <message_count>0</message_count>
    ${reason ? `<note>${escapeXML(reason)}</note>` : ''}
  </metadata>
  <messages></messages>
</conversation>`;
}
