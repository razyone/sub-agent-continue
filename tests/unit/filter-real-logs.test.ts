import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  filterConversation,
  getFilterStatistics,
} from '../../src/lib/filter.js';
import { FILTER_PRESETS } from '../../src/lib/filter-config.js';
import type { ConversationEntry } from '../../src/types/index.js';

describe('Real Conversation Log Tests', () => {
  let realEntries: ConversationEntry[];

  beforeAll(() => {
    try {
      const fixturesPath = join(process.cwd(), 'tests', 'fixtures');
      const complexLogPath = join(fixturesPath, 'complex-conversation.jsonl');
      const content = readFileSync(complexLogPath, 'utf-8');
      realEntries = content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch (_error) {
      realEntries = [];
    }
  });

  it('should handle real complex conversation with smart preset', () => {
    if (realEntries.length === 0) {
      return;
    }

    const result = filterConversation(realEntries, FILTER_PRESETS.smart);

    // Should filter out significant content
    expect(result.length).toBeLessThan(realEntries.length);

    // Check sub-agents are filtered
    const subAgentCalls = result.filter((entry) => {
      if (entry.type !== 'assistant') {
        return false;
      }
      const content = entry.message.content;
      if (Array.isArray(content)) {
        return content.some(
          (item) => item.type === 'tool_use' && item.name === 'Task'
        );
      }
      return false;
    });
    expect(subAgentCalls.length).toBe(0);
  });

  it('should calculate accurate statistics for real conversation', () => {
    if (realEntries.length === 0) {
      return;
    }

    const stats = getFilterStatistics(realEntries, FILTER_PRESETS.smart);

    expect(stats.total).toBe(realEntries.length);
    expect(stats.filtered).toBeGreaterThan(0);
    expect(stats.tokensSaved).toBeGreaterThan(0);
  });

  it('should filter with different presets', () => {
    if (realEntries.length === 0) {
      return;
    }

    const noneResult = filterConversation(realEntries, FILTER_PRESETS.none);
    const lightResult = filterConversation(realEntries, FILTER_PRESETS.light);
    const heavyResult = filterConversation(realEntries, FILTER_PRESETS.heavy);

    // None should keep everything
    expect(noneResult.length).toBe(realEntries.length);

    // Light should keep more than heavy
    expect(lightResult.length).toBeGreaterThan(heavyResult.length);

    // Heavy should filter the most
    expect(heavyResult.length).toBeLessThan(lightResult.length);
  });

  it('should handle tool filtering correctly', () => {
    if (realEntries.length === 0) {
      return;
    }

    // Create config that excludes both calls AND results
    const config = {
      ...FILTER_PRESETS.heavy,
      tools: {
        ...FILTER_PRESETS.heavy.tools,
        excludeCategories: ['file_read', 'file_edit'],
        excludeResultsOnly: false, // This ensures both calls and results are filtered
      },
    };

    const result = filterConversation(realEntries, config);

    // Check if file tools are actually filtered
    const hasFileTools = result.some((entry) => {
      if (entry.type !== 'assistant') {
        return false;
      }
      const content = entry.message.content;
      if (Array.isArray(content)) {
        return content.some(
          (item: any) =>
            item.type === 'tool_use' &&
            (item.name === 'Read' ||
              item.name === 'Edit' ||
              item.name === 'Write' ||
              item.name === 'MultiEdit')
        );
      }
      return false;
    });

    // Only check if original had file tools
    const originalFileTools = realEntries.filter((entry) => {
      if (entry.type !== 'assistant') {
        return false;
      }
      const content = entry.message?.content;
      if (Array.isArray(content)) {
        return content.some(
          (item: any) =>
            item.type === 'tool_use' &&
            (item.name === 'Read' ||
              item.name === 'Edit' ||
              item.name === 'Write' ||
              item.name === 'MultiEdit')
        );
      }
      return false;
    });

    if (originalFileTools.length > 0) {
      expect(hasFileTools).toBe(false);
    }
  });

  it('should preserve conversation flow after filtering', () => {
    if (realEntries.length === 0) {
      return;
    }

    const result = filterConversation(realEntries, FILTER_PRESETS.heavy);

    // Should have both user and assistant messages
    const hasUser = result.some((e) => e.type === 'user');
    const hasAssistant = result.some((e) => e.type === 'assistant');

    expect(hasUser).toBe(true);
    expect(hasAssistant).toBe(true);

    // Heavy preset filters thinking and sub-agents, but keeps most content
    const percentageRemaining = (result.length / realEntries.length) * 100;
    expect(percentageRemaining).toBeGreaterThan(80); // Heavy preset keeps most content
  });

  it('should handle performance efficiently', () => {
    if (realEntries.length === 0) {
      return;
    }

    const startTime = Date.now();
    const result = filterConversation(realEntries, FILTER_PRESETS.heavy);
    const endTime = Date.now();

    const processingTime = endTime - startTime;

    // Should process 755 messages quickly
    expect(processingTime).toBeLessThan(100);
    expect(result).toBeDefined();
  });
});
