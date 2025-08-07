import type { ConversationEntry } from '../types/index.js';
import { readJSONLFile } from './file-system.js';
import { measure } from './performance.js';

export function parseConversationEntry(line: string): ConversationEntry | null {
  try {
    const entry = JSON.parse(line);

    if (!(entry.uuid && entry.timestamp && entry.type && entry.message)) {
      return null;
    }

    return {
      parentUuid: entry.parentUuid || null,
      uuid: entry.uuid,
      timestamp: entry.timestamp,
      type: entry.type,
      message: entry.message,
      toolUseResult: entry.toolUseResult,
    };
  } catch {
    // Error parsing conversation entry
    return null;
  }
}

export function parseConversationFile(filePath: string): ConversationEntry[] {
  return measure(`parseConversationFile:${filePath}`, () => {
    const lines = readJSONLFile(filePath);
    const entries: ConversationEntry[] = [];

    for (const line of lines) {
      const entry = parseConversationEntry(line);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  });
}

export function filterByMessageType(
  entries: ConversationEntry[],
  type: 'user' | 'assistant'
): ConversationEntry[] {
  return entries.filter((entry) => entry.type === type);
}

export function getUpToUserMessage(
  entries: ConversationEntry[],
  userMessageIndex: number
): ConversationEntry[] {
  if (userMessageIndex <= 0) {
    return [];
  }

  const result: ConversationEntry[] = [];
  let userMessageCount = 0;

  for (const entry of entries) {
    if (entry.type === 'user') {
      userMessageCount++;
      if (userMessageCount >= userMessageIndex) {
        break;
      }
    }
    result.push(entry);
  }

  return result;
}

export function extractMessageContent(entry: ConversationEntry): string {
  const content = entry.message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item.type === 'text' && item.text) {
          return item.text;
        }
        if (item.type === 'tool_use' && item.name) {
          return `[Tool: ${item.name}]`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (obj.text && typeof obj.text === 'string') {
      return obj.text;
    }
    if (obj.type === 'text' && obj.content && typeof obj.content === 'string') {
      return obj.content;
    }
  }

  return '';
}
