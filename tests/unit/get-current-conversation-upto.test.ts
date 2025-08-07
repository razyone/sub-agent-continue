import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentConversationUpto,
  getCurrentConversationUptoSchema,
} from '../../src/tools/get-current-conversation-upto';
import type { ConversationEntry, ConversationFile } from '../../src/types';

// Mock all dependencies
vi.mock('../../src/lib/cache', () => ({
  getCacheKey: vi.fn((path, suffix) => (suffix ? `${path}:${suffix}` : path)),
  getGlobalCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('../../src/lib/file-system', () => ({
  findMostRecentConversation: vi.fn(),
}));

vi.mock('../../src/lib/parser', () => ({
  getUpToUserMessage: vi.fn(),
  parseConversationFile: vi.fn(),
}));

vi.mock('../../src/lib/performance', () => ({
  measure: vi.fn((_label, fn) => fn()),
}));

vi.mock('../../src/lib/xml', () => ({
  createEmptyConversationXML: vi.fn(
    (reason) => `<empty>${reason || ''}</empty>`
  ),
  createErrorXML: vi.fn((error) => `<error>${error}</error>`),
  toXML: vi.fn(
    (entries, metadata) =>
      `<xml entries="${entries.length}" session="${metadata?.sessionId || ''}" project="${metadata?.projectPath || ''}"></xml>`
  ),
}));

// Import mocked functions
import { getCacheKey, getGlobalCache } from '../../src/lib/cache';
import { findMostRecentConversation } from '../../src/lib/file-system';
import {
  getUpToUserMessage,
  parseConversationFile,
} from '../../src/lib/parser';
import {
  createEmptyConversationXML,
  createErrorXML,
  toXML,
} from '../../src/lib/xml';

describe('getCurrentConversationUpto', () => {
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const mockConversationFile: ConversationFile = {
    path: '/project/session456.jsonl',
    sessionId: 'session456',
    mtime: new Date('2024-01-01T10:00:00Z'),
  };

  const mockEntries: ConversationEntry[] = [
    {
      parentUuid: null,
      uuid: '1',
      timestamp: '2024-01-01T10:00:00Z',
      type: 'user',
      message: { role: 'user', content: 'First user message' },
    },
    {
      parentUuid: '1',
      uuid: '2',
      timestamp: '2024-01-01T10:01:00Z',
      type: 'assistant',
      message: { role: 'assistant', content: 'Assistant response' },
    },
    {
      parentUuid: '2',
      uuid: '3',
      timestamp: '2024-01-01T10:02:00Z',
      type: 'user',
      message: { role: 'user', content: 'Second user message' },
    },
  ];

  const mockFilteredEntries = mockEntries.slice(0, 2); // Up to but not including 2nd user message

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGlobalCache).mockReturnValue(mockCache);
    // Reset createErrorXML to default implementation
    vi.mocked(createErrorXML).mockImplementation(
      (error) => `<error>${error}</error>`
    );

    // Mock process.cwd
    const originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue('/current/working/directory');

    return () => {
      process.cwd = originalCwd;
    };
  });

  describe('successful execution', () => {
    it('should return conversation up to nth user message from cache', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      vi.mocked(getCacheKey).mockReturnValue('/project/session456.jsonl');
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue(mockFilteredEntries);

      const result = await getCurrentConversationUpto({
        userMessageIndex: 2,
        projectPath: '/custom/project',
      });

      expect(findMostRecentConversation).toHaveBeenCalledWith(
        '/custom/project'
      );
      expect(getCacheKey).toHaveBeenCalledWith(
        '/project/session456.jsonl',
        undefined
      );
      expect(mockCache.get).toHaveBeenCalledWith('/project/session456.jsonl');
      expect(getUpToUserMessage).toHaveBeenCalledWith(mockEntries, 2);
      expect(toXML).toHaveBeenCalledWith(mockFilteredEntries, {
        sessionId: 'session456',
        projectPath: '/custom/project',
      });
      expect(result).toBe(
        '<xml entries="2" session="session456" project="/custom/project"></xml>'
      );
    });

    it('should parse conversation file when not in cache', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(null);
      vi.mocked(parseConversationFile).mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue(mockFilteredEntries);

      const result = await getCurrentConversationUpto({
        userMessageIndex: 3,
      });

      expect(parseConversationFile).toHaveBeenCalledWith(
        '/project/session456.jsonl'
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        '/project/session456.jsonl',
        mockEntries
      );
      expect(getUpToUserMessage).toHaveBeenCalledWith(mockEntries, 3);
      expect(result).toContain('entries="2"');
    });

    it('should use current working directory when no project path provided', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue(mockFilteredEntries);

      await getCurrentConversationUpto({ userMessageIndex: 1 });

      expect(findMostRecentConversation).toHaveBeenCalledWith(undefined);
      expect(toXML).toHaveBeenCalledWith(mockFilteredEntries, {
        sessionId: 'session456',
        projectPath: '/current/working/directory',
      });
    });
  });

  describe('validation and error handling', () => {
    it('should return empty conversation XML for invalid user message index (zero)', async () => {
      vi.mocked(createEmptyConversationXML).mockReturnValue(
        '<empty>User message index must be greater than 0</empty>'
      );

      const result = await getCurrentConversationUpto({
        userMessageIndex: 0,
      });

      expect(createEmptyConversationXML).toHaveBeenCalledWith(
        'User message index must be greater than 0'
      );
      expect(result).toBe(
        '<empty>User message index must be greater than 0</empty>'
      );
      expect(findMostRecentConversation).not.toHaveBeenCalled();
    });

    it('should return empty conversation XML for negative user message index', async () => {
      vi.mocked(createEmptyConversationXML).mockReturnValue(
        '<empty>User message index must be greater than 0</empty>'
      );

      const result = await getCurrentConversationUpto({
        userMessageIndex: -1,
      });

      expect(createEmptyConversationXML).toHaveBeenCalledWith(
        'User message index must be greater than 0'
      );
      expect(result).toBe(
        '<empty>User message index must be greater than 0</empty>'
      );
    });

    it('should return empty conversation XML when no conversation found', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(null);
      vi.mocked(createEmptyConversationXML).mockReturnValue(
        '<empty>No conversations found for this project</empty>'
      );

      const result = await getCurrentConversationUpto({
        userMessageIndex: 1,
      });

      expect(createEmptyConversationXML).toHaveBeenCalledWith(
        'No conversations found for this project'
      );
      expect(result).toBe(
        '<empty>No conversations found for this project</empty>'
      );
    });

    it('should return empty conversation XML when no filtered messages found', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue([]);
      vi.mocked(createEmptyConversationXML).mockReturnValue(
        '<empty>No messages found before user message 5</empty>'
      );

      const result = await getCurrentConversationUpto({
        userMessageIndex: 5,
      });

      expect(createEmptyConversationXML).toHaveBeenCalledWith(
        'No messages found before user message 5'
      );
      expect(result).toBe(
        '<empty>No messages found before user message 5</empty>'
      );
    });

    it('should handle findMostRecentConversation errors', async () => {
      vi.mocked(findMostRecentConversation).mockImplementation(() => {
        throw new Error('File system error');
      });
      vi.mocked(createErrorXML).mockReturnValue(
        '<error>Failed to get conversation up to user message: File system error</error>'
      );

      const result = await getCurrentConversationUpto({
        userMessageIndex: 1,
      });

      expect(createErrorXML).toHaveBeenCalledWith(
        'Failed to get conversation up to user message: File system error'
      );
      expect(result).toBe(
        '<error>Failed to get conversation up to user message: File system error</error>'
      );
    });

    it('should handle parseConversationFile errors', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(null);
      vi.mocked(parseConversationFile).mockImplementation(() => {
        throw new Error('Parse error');
      });
      vi.mocked(createErrorXML).mockReturnValue(
        '<error>Failed to get conversation up to user message: Parse error</error>'
      );

      const _result = await getCurrentConversationUpto({
        userMessageIndex: 1,
      });

      expect(createErrorXML).toHaveBeenCalledWith(
        'Failed to get conversation up to user message: Parse error'
      );
    });

    it('should handle unknown errors', async () => {
      vi.mocked(findMostRecentConversation).mockImplementation(() => {
        throw 'string error';
      });
      vi.mocked(createErrorXML).mockReturnValue(
        '<error>Failed to get conversation up to user message: Unknown error occurred</error>'
      );

      const _result = await getCurrentConversationUpto({
        userMessageIndex: 1,
      });

      expect(createErrorXML).toHaveBeenCalledWith(
        'Failed to get conversation up to user message: Unknown error occurred'
      );
    });

    it('should handle getUpToUserMessage errors', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockImplementation(() => {
        throw new Error('Filter error');
      });

      const result = await getCurrentConversationUpto({
        userMessageIndex: 1,
      });

      expect(result).toContain('Filter error');
    });
  });

  describe('cache behavior', () => {
    it('should use same cache key regardless of user message index', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue(mockFilteredEntries);

      await getCurrentConversationUpto({ userMessageIndex: 1 });
      await getCurrentConversationUpto({ userMessageIndex: 3 });

      // Cache key should be the same (just the file path, no suffix)
      expect(getCacheKey).toHaveBeenCalledWith(
        '/project/session456.jsonl',
        undefined
      );
      expect(getCacheKey).toHaveBeenCalledTimes(2);
      expect(mockCache.get).toHaveBeenCalledWith('/project/session456.jsonl');
      expect(mockCache.get).toHaveBeenCalledTimes(2);
    });

    it('should cache parsed entries', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(null);
      vi.mocked(parseConversationFile).mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue(mockFilteredEntries);

      await getCurrentConversationUpto({ userMessageIndex: 2 });

      expect(mockCache.set).toHaveBeenCalledWith(
        '/project/session456.jsonl',
        mockEntries
      );
    });
  });

  describe('filtering behavior', () => {
    it('should call getUpToUserMessage with correct parameters', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage).mockReturnValue(mockFilteredEntries);

      await getCurrentConversationUpto({ userMessageIndex: 5 });

      expect(getUpToUserMessage).toHaveBeenCalledWith(mockEntries, 5);
      expect(getUpToUserMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle different user message indices', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);
      vi.mocked(getUpToUserMessage)
        .mockReturnValueOnce([mockEntries[0]!]) // For userMessageIndex: 1
        .mockReturnValueOnce(mockEntries.slice(0, 2)); // For userMessageIndex: 2

      await getCurrentConversationUpto({ userMessageIndex: 1 });
      await getCurrentConversationUpto({ userMessageIndex: 2 });

      expect(getUpToUserMessage).toHaveBeenCalledWith(mockEntries, 1);
      expect(getUpToUserMessage).toHaveBeenCalledWith(mockEntries, 2);
    });
  });
});

describe('getCurrentConversationUptoSchema', () => {
  it('should have correct schema properties', () => {
    expect(getCurrentConversationUptoSchema.name).toBe(
      'getCurrentConversationUpto'
    );
    expect(getCurrentConversationUptoSchema.description).toContain(
      'up to (but not including) the nth user message'
    );
    expect(getCurrentConversationUptoSchema.inputSchema.type).toBe('object');
  });

  it('should have correct property definitions', () => {
    const { properties } = getCurrentConversationUptoSchema.inputSchema;

    expect(properties.projectPath).toEqual({
      type: 'string',
      description:
        'Project path to get conversation from (defaults to current directory)',
    });

    expect(properties.userMessageIndex).toEqual({
      type: 'number',
      description:
        'Get messages up to (but not including) this user message number',
      minimum: 1,
    });
  });

  it('should have userMessageIndex as required property', () => {
    expect(getCurrentConversationUptoSchema.inputSchema.required).toEqual([
      'userMessageIndex',
    ]);
  });
});
