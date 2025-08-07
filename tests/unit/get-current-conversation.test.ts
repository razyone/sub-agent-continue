import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentConversation,
  getCurrentConversationSchema,
} from '../../src/tools/get-current-conversation';
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
import { parseConversationFile } from '../../src/lib/parser';
import {
  createEmptyConversationXML,
  createErrorXML,
  toXML,
} from '../../src/lib/xml';

describe('getCurrentConversation', () => {
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const mockConversationFile: ConversationFile = {
    path: '/project/session123.jsonl',
    sessionId: 'session123',
    mtime: new Date('2024-01-01T10:00:00Z'),
  };

  const mockEntries: ConversationEntry[] = [
    {
      parentUuid: null,
      uuid: '1',
      timestamp: '2024-01-01T10:00:00Z',
      type: 'user',
      message: { role: 'user', content: 'First message' },
    },
    {
      parentUuid: '1',
      uuid: '2',
      timestamp: '2024-01-01T10:01:00Z',
      type: 'assistant',
      message: { role: 'assistant', content: 'Second message' },
    },
  ];

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
    it('should return recent conversation from cache when available', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      vi.mocked(getCacheKey).mockReturnValue(
        '/project/session123.jsonl:recent:50'
      );
      mockCache.get.mockReturnValue(mockEntries);

      const result = await getCurrentConversation({});

      expect(findMostRecentConversation).toHaveBeenCalledWith(undefined);
      expect(getCacheKey).toHaveBeenCalledWith(
        '/project/session123.jsonl',
        'full'
      );
      expect(mockCache.get).toHaveBeenCalledWith(
        '/project/session123.jsonl:recent:50'
      );
      // Should exclude the last user message (index 0), so empty array
      expect(toXML).toHaveBeenCalledWith([], {
        sessionId: 'session123',
        projectPath: '/current/working/directory',
      });
      expect(result).toBe(
        '<xml entries="0" session="session123" project="/current/working/directory"></xml>'
      );
    });

    it('should parse conversation file when not in cache', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      vi.mocked(getCacheKey).mockReturnValue(
        '/project/session123.jsonl:recent:100'
      );
      mockCache.get.mockReturnValue(null);
      vi.mocked(parseConversationFile).mockReturnValue(mockEntries);

      const result = await getCurrentConversation({});

      expect(parseConversationFile).toHaveBeenCalledWith(
        '/project/session123.jsonl'
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        '/project/session123.jsonl:recent:100',
        mockEntries
      );
      // Should exclude the last user message, so empty
      expect(result).toContain('entries="0"');
    });

    it('should return full conversation when called', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);

      await getCurrentConversation({});

      expect(getCacheKey).toHaveBeenCalledWith(
        '/project/session123.jsonl',
        'full'
      );
    });

    it('should use provided project path', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);

      const _result = await getCurrentConversation({
        projectPath: '/custom/project',
      });

      expect(findMostRecentConversation).toHaveBeenCalledWith(
        '/custom/project'
      );
      // Should exclude the last user message
      expect(toXML).toHaveBeenCalledWith([], {
        sessionId: 'session123',
        projectPath: '/custom/project',
      });
    });

    it('should exclude last user message from entries', async () => {
      const manyEntries = Array.from({ length: 200 }, (_, i) => ({
        parentUuid: null,
        uuid: `${i + 1}`,
        timestamp: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`,
        type: 'user' as const,
        message: { role: 'user', content: `Message ${i + 1}` },
      }));

      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(manyEntries);

      await getCurrentConversation({});

      // Should call toXML with entries up to (but not including) the last user message
      // Since all entries are user messages, it should exclude from index 199
      const expectedSlice = manyEntries.slice(0, 199);
      expect(toXML).toHaveBeenCalledWith(expectedSlice, expect.any(Object));
    });

    it('should handle mixed user and assistant messages correctly', async () => {
      const mixedEntries: ConversationEntry[] = [
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
          message: { role: 'assistant', content: 'First assistant response' },
        },
        {
          parentUuid: '2',
          uuid: '3',
          timestamp: '2024-01-01T10:02:00Z',
          type: 'user',
          message: { role: 'user', content: 'Second user message' },
        },
        {
          parentUuid: '3',
          uuid: '4',
          timestamp: '2024-01-01T10:03:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Second assistant response' },
        },
      ];

      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mixedEntries);

      await getCurrentConversation({});

      // Should exclude from the last user message (index 2) onwards
      const expectedSlice = mixedEntries.slice(0, 2);
      expect(toXML).toHaveBeenCalledWith(expectedSlice, expect.any(Object));
    });
  });

  describe('error handling', () => {
    it('should return empty conversation XML when no conversation found', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(null);
      vi.mocked(createEmptyConversationXML).mockReturnValue(
        '<empty>No conversations found</empty>'
      );

      const result = await getCurrentConversation({});

      expect(createEmptyConversationXML).toHaveBeenCalledWith(
        'No conversations found for this project'
      );
      expect(result).toBe('<empty>No conversations found</empty>');
    });

    it('should handle findMostRecentConversation errors', async () => {
      vi.mocked(findMostRecentConversation).mockImplementation(() => {
        throw new Error('File system error');
      });
      vi.mocked(createErrorXML).mockReturnValue(
        '<error>Failed to get recent conversation: File system error</error>'
      );

      const result = await getCurrentConversation({});

      expect(createErrorXML).toHaveBeenCalledWith(
        'Failed to get current conversation: File system error'
      );
      expect(result).toBe(
        '<error>Failed to get recent conversation: File system error</error>'
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

      const result = await getCurrentConversation({});

      expect(result).toContain('Parse error');
    });

    it('should handle unknown errors', async () => {
      vi.mocked(findMostRecentConversation).mockImplementation(() => {
        throw 'string error';
      });
      vi.mocked(createErrorXML).mockReturnValue(
        '<error>Failed to get recent conversation: Unknown error occurred</error>'
      );

      const result = await getCurrentConversation({});

      expect(createErrorXML).toHaveBeenCalledWith(
        'Failed to get current conversation: Unknown error occurred'
      );
      expect(result).toBe(
        '<error>Failed to get recent conversation: Unknown error occurred</error>'
      );
    });
  });

  describe('cache behavior', () => {
    it('should use consistent cache key', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(mockEntries);

      await getCurrentConversation({});
      await getCurrentConversation({});

      expect(getCacheKey).toHaveBeenCalledWith(
        '/project/session123.jsonl',
        'full'
      );
      expect(getCacheKey).toHaveBeenCalledTimes(2);
    });

    it('should cache parsed entries', async () => {
      vi.mocked(findMostRecentConversation).mockReturnValue(
        mockConversationFile
      );
      mockCache.get.mockReturnValue(null);
      vi.mocked(parseConversationFile).mockReturnValue(mockEntries);
      vi.mocked(getCacheKey).mockReturnValue('cache-key');

      await getCurrentConversation({});

      expect(mockCache.set).toHaveBeenCalledWith('cache-key', mockEntries);
    });
  });
});

describe('getCurrentConversationSchema', () => {
  it('should have correct schema properties', () => {
    expect(getCurrentConversationSchema.name).toBe('getCurrentConversation');
    expect(getCurrentConversationSchema.description).toContain(
      'entire conversation'
    );
    expect(getCurrentConversationSchema.inputSchema.type).toBe('object');
  });

  it('should have correct property definitions', () => {
    const { properties } = getCurrentConversationSchema.inputSchema;

    expect(properties.projectPath).toEqual({
      type: 'string',
      description:
        'Project path to get conversation from (defaults to current directory)',
    });

    expect(properties.limit).toBeUndefined();
  });

  it('should not have required properties', () => {
    expect(getCurrentConversationSchema.inputSchema.required).toBeUndefined();
  });
});
