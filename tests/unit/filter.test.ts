import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterConversation,
  getFilterStatistics,
} from '../../src/lib/filter.js';
import type { FilterConfig } from '../../src/lib/filter-config.js';
import type { ConversationEntry } from '../../src/types/index.js';

// Mock the filter-config module
vi.mock('../../src/lib/filter-config.js', () => ({
  getFilterConfigFromEnv: vi.fn(),
  TOOL_CATEGORIES: {
    Edit: 'file_edit',
    MultiEdit: 'file_edit',
    Write: 'file_edit',
    Read: 'file_read',
    Task: 'analysis',
    WebSearch: 'web',
    TodoWrite: 'project',
  },
  ToolCategory: {
    FILE_EDIT: 'file_edit',
    FILE_READ: 'file_read',
    ANALYSIS: 'analysis',
    WEB: 'web',
    PROJECT: 'project',
  },
}));

describe('filterConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Content Filtering', () => {
    it('should remove thinking blocks', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content:
              'Before thinking <thinking>Internal reasoning here</thinking> After thinking',
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: true,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(1);
      expect(result[0].message.content).toBe('Before thinking  After thinking');
    });

    it('should remove anythingllm:thinking blocks', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content:
              'Text <anythingllm:thinking>Internal thoughts</anythingllm:thinking> More text',
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: true,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result[0].message.content).toBe('Text  More text');
    });

    it('should remove system reminders when configured', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content:
              'Normal text <system-reminder>This is a reminder</system-reminder> More text',
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: true,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result[0].message.content).toBe('Normal text  More text');
    });

    it('should truncate long messages', () => {
      const longContent = 'a'.repeat(150);
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: {
            role: 'user',
            content: longContent,
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {
          maxLength: 100,
        },
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result[0].message.content).toBe(
        `${'a'.repeat(100)}...[truncated]`
      );
    });
  });

  describe('Sub-Agent Filtering', () => {
    it('should filter Task tool calls when configured', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool1',
                name: 'Task',
                input: { prompt: 'Do something' },
              },
            ],
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: true,
          excludeResponses: false,
        },
        tools: {},
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(0);
    });

    it('should filter sub-agent responses with performance metrics', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool1',
                content: 'Sub-agent response',
              },
            ],
          },
          toolUseResult: {
            content: 'Sub-agent response',
            totalDurationMs: 5000,
            totalTokens: 1000,
            totalToolUseCount: 3,
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: true,
        },
        tools: {},
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(0);
    });
  });

  describe('Tool Filtering', () => {
    it('should filter tools by category', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool1',
                name: 'Edit',
                input: { file: 'test.ts' },
              },
            ],
          },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:00:01Z',
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool1',
                content: 'File edited',
              },
            ],
          },
          toolUseResult: 'File edited',
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {
          excludeCategories: ['file_edit'],
        },
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(0);
    });

    it('should filter specific tools by name', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool1',
                name: 'TodoWrite',
                input: { task: 'Do something' },
              },
            ],
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {
          excludeSpecific: ['TodoWrite'],
        },
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(0);
    });

    it('should filter only tool calls when excludeCallsOnly is true', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool1',
                name: 'Read',
                input: { file: 'test.ts' },
              },
            ],
          },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:00:01Z',
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool1',
                content: 'File contents',
              },
            ],
          },
          toolUseResult: 'File contents',
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {
          excludeCategories: ['file_read'],
          excludeCallsOnly: true,
        },
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('2'); // Only result remains
    });

    it('should filter failed tools when configured', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool1',
                content: '[Request interrupted by user]',
                is_error: true,
              },
            ],
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {
          excludeFailed: true,
        },
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(0);
    });
  });

  describe('Message Filtering', () => {
    it('should filter empty messages', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: '',
          },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:00:01Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Non-empty message',
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {
          excludeEmpty: true,
        },
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('2');
    });

    it('should filter messages by role', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: {
            role: 'user',
            content: 'User message',
          },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:00:01Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Assistant message',
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: false,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {
          excludeByRole: ['user'],
        },
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('2');
      expect(result[0].type).toBe('assistant');
    });

    it('should filter empty array content', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '<thinking>only thinking</thinking>',
              },
            ],
          },
        },
        {
          parentUuid: '1',
          uuid: '2',
          timestamp: '2024-01-01T00:00:01Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Real content',
              },
            ],
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: true,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {
          excludeEmpty: true,
        },
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      // First message has empty text after filtering thinking
      // But the array item itself remains
      expect(result).toHaveLength(2);
      expect(result[0].uuid).toBe('1');
      expect(result[1].uuid).toBe('2');
      // Check that first message content has empty text
      const firstContent = result[0].message.content as any[];
      expect(firstContent).toHaveLength(1);
      expect(firstContent[0].text).toBe('');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle array content with multiple types', () => {
      const entries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: '1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Before <thinking>thoughts</thinking> after',
              },
              {
                type: 'tool_use',
                id: 'tool1',
                name: 'Read',
                input: {},
              },
            ],
          },
        },
      ];

      const config: FilterConfig = {
        content: {
          excludeThinking: true,
          excludeSystemReminders: false,
          excludeErrors: false,
        },
        subAgents: {
          excludeCalls: false,
          excludeResponses: false,
        },
        tools: {},
        messages: {},
        advanced: {
          preserveContext: true,
          compactMode: false,
        },
      };

      const result = filterConversation(entries, config);
      expect(result).toHaveLength(1);
      const content = result[0].message.content as any[];
      expect(content[0].text).toBe('Before  after');
    });
  });
});

describe('getFilterStatistics', () => {
  it('should calculate correct statistics for sub-agents and thinking', () => {
    const entries: ConversationEntry[] = [
      {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Text with <thinking>thoughts</thinking>',
        },
      },
      {
        parentUuid: '1',
        uuid: '2',
        timestamp: '2024-01-01T00:00:01Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool1',
              name: 'Task',
              input: {},
            },
          ],
        },
      },
      {
        parentUuid: '2',
        uuid: '3',
        timestamp: '2024-01-01T00:00:02Z',
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool1',
              content: 'Sub-agent response',
            },
          ],
        },
        toolUseResult: {
          content: 'Sub-agent response',
          totalDurationMs: 5000,
          totalTokens: 2000,
          totalToolUseCount: 3,
        },
      },
    ];

    const config: FilterConfig = {
      content: {
        excludeThinking: true,
        excludeSystemReminders: false,
        excludeErrors: false,
      },
      subAgents: {
        excludeCalls: true,
        excludeResponses: true,
      },
      tools: {},
      messages: {},
      advanced: {
        preserveContext: true,
        compactMode: false,
      },
    };

    const stats = getFilterStatistics(entries, config);

    expect(stats.total).toBe(3);
    expect(stats.filtered).toBe(2); // Task call and response filtered
    expect(stats.byCategory.thinking).toBe(1);
    expect(stats.byCategory.subAgentCalls).toBe(1);
    expect(stats.byCategory.subAgentResponses).toBe(1);
    expect(stats.tokensSaved).toBeGreaterThan(0);
  });

  it('should calculate statistics for tool filtering', () => {
    const entries: ConversationEntry[] = [
      {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool1',
              name: 'Edit',
              input: { file: 'test.ts' },
            },
          ],
        },
      },
      {
        parentUuid: '1',
        uuid: '2',
        timestamp: '2024-01-01T00:00:01Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool2',
              name: 'Write',
              input: { file: 'new.ts' },
            },
          ],
        },
      },
    ];

    const config: FilterConfig = {
      content: {
        excludeThinking: false,
        excludeSystemReminders: false,
        excludeErrors: false,
      },
      subAgents: {
        excludeCalls: false,
        excludeResponses: false,
      },
      tools: {
        excludeCategories: ['file_edit'],
      },
      messages: {},
      advanced: {
        preserveContext: true,
        compactMode: false,
      },
    };

    const stats = getFilterStatistics(entries, config);

    expect(stats.total).toBe(2);
    expect(stats.byCategory.tools).toBe(2); // Both Edit and Write are file_edit
    expect(stats.tokensSaved).toBe(400); // 200 per tool
  });

  it('should calculate statistics for failed tools', () => {
    const entries: ConversationEntry[] = [
      {
        parentUuid: null,
        uuid: '1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool1',
              content: '[Request interrupted by user]',
              is_error: true,
            },
          ],
        },
      },
      {
        parentUuid: '1',
        uuid: '2',
        timestamp: '2024-01-01T00:00:01Z',
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool2',
              content: 'Error: File not found',
              is_error: true,
            },
          ],
        },
      },
    ];

    const config: FilterConfig = {
      content: {
        excludeThinking: false,
        excludeSystemReminders: false,
        excludeErrors: false,
      },
      subAgents: {
        excludeCalls: false,
        excludeResponses: false,
      },
      tools: {
        excludeFailed: true,
      },
      messages: {},
      advanced: {
        preserveContext: true,
        compactMode: false,
      },
    };

    const stats = getFilterStatistics(entries, config);

    expect(stats.total).toBe(2);
    expect(stats.byCategory.failed).toBe(2);
    expect(stats.tokensSaved).toBe(100); // 50 per failed tool
  });
});
