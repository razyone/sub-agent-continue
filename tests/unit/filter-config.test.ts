import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FILTER_PRESETS,
  getFilterConfig,
  getFilterConfigFromEnv,
  TOOL_CATEGORIES,
  ToolCategory,
} from '../../src/lib/filter-config.js';

describe('filter-config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a copy of the original env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('FILTER_PRESETS', () => {
    it('should have none preset with no filtering', () => {
      const none = FILTER_PRESETS.none;

      // Content filtering
      expect(none.content.excludeThinking).toBe(false);
      expect(none.content.excludeSystemReminders).toBe(false);
      expect(none.content.excludeErrors).toBe(false);

      // Sub-agent filtering
      expect(none.subAgents.excludeCalls).toBe(false);
      expect(none.subAgents.excludeResponses).toBe(false);

      // Tool filtering
      expect(none.tools.excludeCategories).toEqual([]);
      expect(none.tools.excludeSpecific).toEqual([]);
      expect(none.tools.excludeFailed).toBe(false);

      // Message filtering
      expect(none.messages.excludeEmpty).toBe(false);
    });

    it('should have light preset with only reasoning filtered', () => {
      const light = FILTER_PRESETS.light;

      // Content filtering - only thinking is excluded
      expect(light.content.excludeThinking).toBe(true);
      expect(light.content.excludeSystemReminders).toBe(false);
      expect(light.content.excludeErrors).toBe(false);

      // Sub-agent filtering - not excluded
      expect(light.subAgents.excludeCalls).toBe(false);
      expect(light.subAgents.excludeResponses).toBe(false);

      // Tool filtering - nothing excluded
      expect(light.tools.excludeCategories).toEqual([]);
      expect(light.tools.excludeFailed).toBe(false);

      // Message filtering
      expect(light.messages.excludeEmpty).toBe(false);
    });

    it('should have heavy preset with reasoning and sub-agents filtered', () => {
      const heavy = FILTER_PRESETS.heavy;

      // Content filtering - thinking is excluded
      expect(heavy.content.excludeThinking).toBe(true);
      expect(heavy.content.excludeSystemReminders).toBe(false);
      expect(heavy.content.excludeErrors).toBe(false);

      // Sub-agent filtering - excluded
      expect(heavy.subAgents.excludeCalls).toBe(true);
      expect(heavy.subAgents.excludeResponses).toBe(true);

      // Tool filtering - nothing excluded
      expect(heavy.tools.excludeCategories).toEqual([]);
      expect(heavy.tools.excludeFailed).toBe(false);

      // Message filtering
      expect(heavy.messages.excludeEmpty).toBe(false);
    });
  });

  describe('TOOL_CATEGORIES', () => {
    it('should categorize file editing tools correctly', () => {
      expect(TOOL_CATEGORIES.Edit).toBe(ToolCategory.FILE_EDIT);
      expect(TOOL_CATEGORIES.MultiEdit).toBe(ToolCategory.FILE_EDIT);
      expect(TOOL_CATEGORIES.Write).toBe(ToolCategory.FILE_EDIT);
      expect(TOOL_CATEGORIES.NotebookEdit).toBe(ToolCategory.FILE_EDIT);
    });

    it('should categorize file reading tools correctly', () => {
      expect(TOOL_CATEGORIES.Read).toBe(ToolCategory.FILE_READ);
      expect(TOOL_CATEGORIES.Glob).toBe(ToolCategory.FILE_READ);
      expect(TOOL_CATEGORIES.Grep).toBe(ToolCategory.FILE_READ);
      expect(TOOL_CATEGORIES.LS).toBe(ToolCategory.FILE_READ);
    });

    it('should categorize other tools correctly', () => {
      expect(TOOL_CATEGORIES.Bash).toBe(ToolCategory.EXECUTION);
      expect(TOOL_CATEGORIES.WebSearch).toBe(ToolCategory.WEB);
      expect(TOOL_CATEGORIES.Task).toBe(ToolCategory.ANALYSIS);
      expect(TOOL_CATEGORIES.TodoWrite).toBe(ToolCategory.PROJECT);
    });
  });

  describe('getFilterConfigFromEnv', () => {
    it('should use heavy preset by default', () => {
      const config = getFilterConfigFromEnv();

      expect(config.content.excludeThinking).toBe(true);
      expect(config.content.excludeSystemReminders).toBe(false);
      expect(config.subAgents.excludeCalls).toBe(true);
      expect(config.subAgents.excludeResponses).toBe(true);
      expect(config.tools.excludeFailed).toBe(false);
    });

    it('should load specified preset via getFilterConfig', () => {
      const config = getFilterConfig('light');

      expect(config.content.excludeThinking).toBe(true);
      expect(config.content.excludeSystemReminders).toBe(false);
      expect(config.subAgents.excludeCalls).toBe(false);
      expect(config.subAgents.excludeResponses).toBe(false);
      expect(config.tools.excludeFailed).toBe(false);
    });

    it('should override preset with environment variables', () => {
      process.env.SUBAGENT_EXCLUDE_THINKING = 'false';
      process.env.SUBAGENT_EXCLUDE_SUBAGENT_CALLS = 'false';

      const config = getFilterConfigFromEnv();

      expect(config.content.excludeThinking).toBe(false);
      expect(config.subAgents.excludeCalls).toBe(false);
      // Heavy preset values should remain (default)
      expect(config.subAgents.excludeResponses).toBe(true);
    });

    it('should parse tool categories from environment', () => {
      process.env.SUBAGENT_EXCLUDE_TOOL_CATEGORIES = 'file_edit,web';
      const config = getFilterConfigFromEnv();

      expect(config.tools.excludeCategories).toEqual(['file_edit', 'web']);
    });

    it('should parse specific tools from environment', () => {
      process.env.SUBAGENT_EXCLUDE_TOOLS = 'Edit,Write,TodoWrite';
      const config = getFilterConfigFromEnv();

      expect(config.tools.excludeSpecific).toEqual([
        'Edit',
        'Write',
        'TodoWrite',
      ]);
    });

    it('should parse custom patterns from environment', () => {
      process.env.SUBAGENT_CUSTOM_PATTERNS = '<debug>.*?</debug>,TODO:.*';
      const config = getFilterConfigFromEnv();

      expect(config.content.customPatterns).toEqual([
        '<debug>.*?</debug>',
        'TODO:.*',
      ]);
    });

    it('should parse message filtering options', () => {
      process.env.SUBAGENT_MAX_MESSAGE_LENGTH = '5000';
      process.env.SUBAGENT_EXCLUDE_EMPTY = 'true';
      process.env.SUBAGENT_EXCLUDE_ROLES = 'system,debug';

      const config = getFilterConfigFromEnv();

      expect(config.messages.maxLength).toBe(5000);
      expect(config.messages.excludeEmpty).toBe(true);
      expect(config.messages.excludeByRole).toEqual(['system', 'debug']);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.SUBAGENT_EXCLUDE_TOOL_CALLS_ONLY = 'true';
      process.env.SUBAGENT_EXCLUDE_TOOL_RESULTS_ONLY = 'false';
      process.env.SUBAGENT_EXCLUDE_FAILED_TOOLS = 'true';

      const config = getFilterConfigFromEnv();

      expect(config.tools.excludeCallsOnly).toBe(true);
      expect(config.tools.excludeResultsOnly).toBe(false);
      expect(config.tools.excludeFailed).toBe(true);
    });

    it('should handle advanced options', () => {
      process.env.SUBAGENT_PRESERVE_CONTEXT = 'false';
      process.env.SUBAGENT_COMPACT_MODE = 'true';

      const config = getFilterConfigFromEnv();

      expect(config.advanced.preserveContext).toBe(false);
      expect(config.advanced.compactMode).toBe(true);
    });

    it('should use preset values when env vars are not set', () => {
      process.env.SUBAGENT_FILTER_PRESET = 'light';

      const config = getFilterConfigFromEnv();
      const lightPreset = FILTER_PRESETS.light;

      expect(config.content.excludeThinking).toBe(
        lightPreset.content.excludeThinking
      );
      expect(config.content.excludeSystemReminders).toBe(
        lightPreset.content.excludeSystemReminders
      );
      expect(config.tools.excludeFailed).toBe(lightPreset.tools.excludeFailed);
      expect(config.messages.excludeEmpty).toBe(
        lightPreset.messages.excludeEmpty
      );
    });

    it('should handle invalid preset name gracefully', () => {
      // Test with getFilterConfig directly
      const config = getFilterConfig('invalid-preset' as any);

      // Should fall back to heavy preset
      expect(config.content.excludeThinking).toBe(
        FILTER_PRESETS.heavy.content.excludeThinking
      );
      expect(config.subAgents.excludeCalls).toBe(
        FILTER_PRESETS.heavy.subAgents.excludeCalls
      );
    });

    it('should preserve preset defaults for complex tool config', () => {
      process.env.SUBAGENT_FILTER_PRESET = 'heavy';
      process.env.SUBAGENT_EXCLUDE_THINKING = 'false'; // Override one setting

      const config = getFilterConfigFromEnv();

      // Changed value
      expect(config.content.excludeThinking).toBe(false);
      // Preserved from heavy preset
      expect(config.subAgents.excludeCalls).toBe(
        FILTER_PRESETS.heavy.subAgents.excludeCalls
      );
      expect(config.subAgents.excludeResponses).toBe(
        FILTER_PRESETS.heavy.subAgents.excludeResponses
      );
      expect(config.tools.excludeCategories).toEqual(
        FILTER_PRESETS.heavy.tools.excludeCategories
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty environment variables', () => {
      process.env.SUBAGENT_EXCLUDE_TOOL_CATEGORIES = '';
      process.env.SUBAGENT_EXCLUDE_TOOLS = '';
      process.env.SUBAGENT_CUSTOM_PATTERNS = '';

      const config = getFilterConfigFromEnv();

      expect(config.tools.excludeCategories).toBeDefined();
      expect(config.tools.excludeSpecific).toBeDefined();
      expect(config.content.customPatterns).toEqual(['']);
    });

    it('should handle malformed max length', () => {
      process.env.SUBAGENT_MAX_MESSAGE_LENGTH = 'not-a-number';

      const config = getFilterConfigFromEnv();

      expect(config.messages.maxLength).toBeNaN();
    });

    it('should combine preset and env configurations correctly', () => {
      // Env vars should override defaults but not the preset parameter
      process.env.SUBAGENT_EXCLUDE_TOOL_CATEGORIES = 'file_edit';
      process.env.SUBAGENT_EXCLUDE_THINKING = 'false';
      process.env.SUBAGENT_MAX_MESSAGE_LENGTH = '3000';

      const config = getFilterConfigFromEnv();

      // From env override
      expect(config.content.excludeThinking).toBe(false);
      expect(config.tools.excludeCategories).toEqual(['file_edit']);
      expect(config.messages.maxLength).toBe(3000);

      // From minimal preset
      expect(config.content.excludeSystemReminders).toBe(false);
      expect(config.subAgents.excludeCalls).toBe(true);
    });
  });
});
