import { describe, expect, it, vi } from 'vitest';
import {
  extractMessageContent,
  filterByMessageType,
  getUpToUserMessage,
  parseConversationEntry,
  parseConversationFile,
} from '../../src/lib/parser';
import type { ConversationEntry } from '../../src/types';

// Mock dependencies
vi.mock('../../src/lib/file-system', () => ({
  readJSONLFile: vi.fn(),
}));

vi.mock('../../src/lib/performance', () => ({
  measure: vi.fn((_label, fn) => fn()),
}));

import { readJSONLFile } from '../../src/lib/file-system';

describe('Parser', () => {
  describe('parseConversationEntry', () => {
    it('should parse valid conversation entry', () => {
      const line = JSON.stringify({
        parentUuid: null,
        uuid: 'test-uuid',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello',
        },
      });

      const result = parseConversationEntry(line);
      expect(result).not.toBeNull();
      expect(result?.uuid).toBe('test-uuid');
      expect(result?.type).toBe('user');
    });

    it('should return null for invalid entry', () => {
      const result = parseConversationEntry('invalid json');
      expect(result).toBeNull();
    });

    it('should handle entry with toolUseResult', () => {
      const line = JSON.stringify({
        parentUuid: 'parent-123',
        uuid: 'test-uuid',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Using tool now',
        },
        toolUseResult: { success: true, data: 'result' },
      });

      const result = parseConversationEntry(line);
      expect(result).not.toBeNull();
      expect(result?.toolUseResult).toEqual({ success: true, data: 'result' });
    });

    it('should handle entry without parentUuid', () => {
      const line = JSON.stringify({
        uuid: 'test-uuid',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello',
        },
      });

      const result = parseConversationEntry(line);
      expect(result).not.toBeNull();
      expect(result?.parentUuid).toBeNull();
    });

    it('should return null for entry missing required fields', () => {
      const lineWithoutUuid = JSON.stringify({
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: { role: 'user', content: 'Hello' },
      });

      const lineWithoutMessage = JSON.stringify({
        uuid: 'test-uuid',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
      });

      expect(parseConversationEntry(lineWithoutUuid)).toBeNull();
      expect(parseConversationEntry(lineWithoutMessage)).toBeNull();
    });
  });

  describe('parseConversationFile', () => {
    const mockReadJSONLFile = vi.mocked(readJSONLFile);

    it('should parse valid JSONL file', () => {
      const mockLines = [
        JSON.stringify({
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'First' },
        }),
        JSON.stringify({
          uuid: '2',
          timestamp: '2024-01-01T00:01:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Second' },
        }),
      ];

      mockReadJSONLFile.mockReturnValue(mockLines);

      const result = parseConversationFile('/test/path.jsonl');

      expect(result).toHaveLength(2);
      expect(result[0]?.uuid).toBe('1');
      expect(result[1]?.uuid).toBe('2');
      expect(mockReadJSONLFile).toHaveBeenCalledWith('/test/path.jsonl');
    });

    it('should filter out invalid entries', () => {
      const mockLines = [
        JSON.stringify({
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Valid' },
        }),
        'invalid json',
        JSON.stringify({ invalid: 'missing required fields' }),
        JSON.stringify({
          uuid: '2',
          timestamp: '2024-01-01T00:01:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Also valid' },
        }),
      ];

      mockReadJSONLFile.mockReturnValue(mockLines);

      const result = parseConversationFile('/test/path.jsonl');

      expect(result).toHaveLength(2);
      expect(result[0]?.uuid).toBe('1');
      expect(result[1]?.uuid).toBe('2');
    });

    it('should handle empty file', () => {
      mockReadJSONLFile.mockReturnValue([]);

      const result = parseConversationFile('/test/empty.jsonl');

      expect(result).toHaveLength(0);
    });
  });

  describe('filterByMessageType', () => {
    const sampleEntries: ConversationEntry[] = [
      {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: { role: 'user', content: 'User message 1' },
      },
      {
        parentUuid: '1',
        uuid: '2',
        timestamp: '2024-01-01T00:01:00Z',
        type: 'assistant',
        message: { role: 'assistant', content: 'Assistant message 1' },
      },
      {
        parentUuid: '2',
        uuid: '3',
        timestamp: '2024-01-01T00:02:00Z',
        type: 'user',
        message: { role: 'user', content: 'User message 2' },
      },
    ];

    it('should filter user messages', () => {
      const result = filterByMessageType(sampleEntries, 'user');

      expect(result).toHaveLength(2);
      expect(result[0]?.uuid).toBe('1');
      expect(result[1]?.uuid).toBe('3');
      expect(result.every((entry) => entry.type === 'user')).toBe(true);
    });

    it('should filter assistant messages', () => {
      const result = filterByMessageType(sampleEntries, 'assistant');

      expect(result).toHaveLength(1);
      expect(result[0]?.uuid).toBe('2');
      expect(result[0]?.type).toBe('assistant');
    });

    it('should handle empty entries', () => {
      const result = filterByMessageType([], 'user');

      expect(result).toHaveLength(0);
    });
  });

  describe('getUpToUserMessage', () => {
    it('should filter messages up to nth user message', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'First' },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:01:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' },
        },
        {
          parentUuid: '2',
          uuid: '3',
          timestamp: '2024-01-01T00:02:00Z',
          type: 'user',
          message: { role: 'user', content: 'Second' },
        },
        {
          parentUuid: '3',
          uuid: '4',
          timestamp: '2024-01-01T00:03:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' },
        },
        {
          parentUuid: '4',
          uuid: '5',
          timestamp: '2024-01-01T00:04:00Z',
          type: 'user',
          message: { role: 'user', content: 'Third' },
        },
      ];

      const result = getUpToUserMessage(entries, 2);
      expect(result).toHaveLength(2);
      expect(result[0]?.uuid).toBe('1');
      expect(result[1]?.uuid).toBe('2');

      const result2 = getUpToUserMessage(entries, 3);
      expect(result2).toHaveLength(4);
      expect(result2.at(-1)?.uuid).toBe('4');
    });

    it('should return empty array for invalid user message index', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'First' },
        },
      ];

      expect(getUpToUserMessage(entries, 0)).toEqual([]);
      expect(getUpToUserMessage(entries, -1)).toEqual([]);
    });

    it('should handle case where user message index exceeds available messages', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Only user message' },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:01:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Response' },
        },
      ];

      const result = getUpToUserMessage(entries, 5);
      expect(result).toEqual(entries);
    });
  });

  describe('extractMessageContent', () => {
    it('should extract string content', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: { role: 'user', content: 'Simple string content' },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('Simple string content');
    });

    it('should extract content from array with text items', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'First text item' },
            { type: 'text', text: 'Second text item' },
          ],
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('First text item\nSecond text item');
    });

    it('should extract content from array with tool_use items', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will use a tool' },
            { type: 'tool_use', name: 'read_file', id: 'tool1' },
            { type: 'tool_use', name: 'write_file', id: 'tool2' },
          ],
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe(
        'I will use a tool\n[Tool: read_file]\n[Tool: write_file]'
      );
    });

    it('should handle mixed array content with strings', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            'Plain string',
            { type: 'text', text: 'Text object' },
            { type: 'tool_use', name: 'calculate' },
          ],
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('Plain string\nText object\n[Tool: calculate]');
    });

    it('should filter out empty content items', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Valid content' },
            { type: 'unknown_type' },
            '',
            { type: 'text', text: 'More valid content' },
          ],
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('Valid content\nMore valid content');
    });

    it('should extract text from object content', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: { text: 'Object with text property' } as any,
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('Object with text property');
    });

    it('should extract content from object with type and content', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: { type: 'text', content: 'Nested content' } as any,
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('Nested content');
    });

    it('should return empty string for unknown content types', () => {
      const entry: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: { unknown: 'property' } as any,
        },
      };

      const result = extractMessageContent(entry);
      expect(result).toBe('');
    });

    it('should handle null and undefined content', () => {
      const entryWithNull: ConversationEntry = {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: null as any,
        },
      };

      const entryWithUndefined: ConversationEntry = {
        parentUuid: null,
        uuid: '2',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: undefined as any,
        },
      };

      expect(extractMessageContent(entryWithNull)).toBe('');
      expect(extractMessageContent(entryWithUndefined)).toBe('');
    });
  });
});
