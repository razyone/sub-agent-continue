/**
 * Comprehensive filtering configuration for conversation entries
 */

import type { FilterPreset } from '../types/index.js';

export interface FilterConfig {
  // Content filtering
  content: {
    excludeThinking: boolean; // Remove <thinking> and <anythingllm:thinking> blocks
    excludeSystemReminders: boolean; // Remove <system-reminder> blocks
    excludeErrors: boolean; // Remove error messages
    customPatterns?: string[]; // Custom regex patterns to remove
  };

  // Sub-agent filtering
  subAgents: {
    excludeCalls: boolean; // Remove Task tool calls
    excludeResponses: boolean; // Remove Task tool responses
  };

  // Tool filtering
  tools: {
    excludeCategories?: ToolCategory[]; // Categories of tools to exclude
    excludeSpecific?: string[]; // Specific tool names to exclude
    excludeCallsOnly?: boolean; // Remove only calls, keep results
    excludeResultsOnly?: boolean; // Remove only results, keep calls
    excludeFailed?: boolean; // Remove failed tool uses
  };

  // Message filtering
  messages: {
    excludeEmpty?: boolean; // Remove empty messages
    excludeByRole?: string[]; // Exclude by role (user/assistant/system)
    maxLength?: number; // Truncate messages longer than this
  };

  // Advanced options
  advanced: {
    preserveContext?: boolean; // Keep minimal context even when filtering
    compactMode?: boolean; // Aggressive space-saving mode
  };
}

export const ToolCategory = {
  FILE_EDIT: 'file_edit' as const, // Edit, MultiEdit, Write
  FILE_READ: 'file_read' as const, // Read, Glob, Grep, LS
  EXECUTION: 'execution' as const, // Bash, NotebookEdit
  WEB: 'web' as const, // WebSearch, WebFetch
  ANALYSIS: 'analysis' as const, // Task (sub-agents)
  PROJECT: 'project' as const, // Git operations, PR creation
  MCP: 'mcp' as const, // MCP-specific tools
} as const;

export type ToolCategory = (typeof ToolCategory)[keyof typeof ToolCategory];

// Tool categorization map
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // File editing tools
  Edit: ToolCategory.FILE_EDIT,
  MultiEdit: ToolCategory.FILE_EDIT,
  Write: ToolCategory.FILE_EDIT,
  NotebookEdit: ToolCategory.FILE_EDIT,

  // File reading tools
  Read: ToolCategory.FILE_READ,
  Glob: ToolCategory.FILE_READ,
  Grep: ToolCategory.FILE_READ,
  LS: ToolCategory.FILE_READ,

  // Execution tools
  Bash: ToolCategory.EXECUTION,
  mcp__ide__executeCode: ToolCategory.EXECUTION,

  // Web tools
  WebSearch: ToolCategory.WEB,
  WebFetch: ToolCategory.WEB,

  // Analysis tools
  Task: ToolCategory.ANALYSIS,

  // Project tools
  ExitPlanMode: ToolCategory.PROJECT,
  TodoWrite: ToolCategory.PROJECT,

  // MCP tools
  mcp__ide__getDiagnostics: ToolCategory.MCP,
};

// Preset configurations
export const FILTER_PRESETS = {
  // No filtering - show everything
  none: {
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
      excludeCategories: [],
      excludeSpecific: [],
      excludeFailed: false,
    },
    messages: {
      excludeEmpty: false,
    },
    advanced: {
      preserveContext: true,
      compactMode: false,
    },
  },

  // Light filtering - only skip reasoning
  light: {
    content: {
      excludeThinking: true,
      excludeSystemReminders: false,
      excludeErrors: false,
    },
    subAgents: {
      excludeCalls: false,
      excludeResponses: false,
    },
    tools: {
      excludeCategories: [],
      excludeSpecific: [],
      excludeFailed: false,
    },
    messages: {
      excludeEmpty: false,
    },
    advanced: {
      preserveContext: true,
      compactMode: false,
    },
  },

  // Heavy filtering (default) - skip reasoning and sub-agents
  heavy: {
    content: {
      excludeThinking: true,
      excludeSystemReminders: false,
      excludeErrors: false,
    },
    subAgents: {
      excludeCalls: true,
      excludeResponses: true,
    },
    tools: {
      excludeCategories: [],
      excludeSpecific: [],
      excludeFailed: false,
    },
    messages: {
      excludeEmpty: false,
    },
    advanced: {
      preserveContext: true,
      compactMode: false,
    },
  },
} as const;

/**
 * Helper to get boolean value from environment variable with default
 */
function getEnvBoolean(
  envVar: string | undefined,
  defaultValue: boolean
): boolean {
  if (envVar === undefined) {
    return defaultValue;
  }
  return envVar === 'true';
}

/**
 * Helper to get string array from environment variable
 */
function getEnvStringArray(envVar: string | undefined): string[] | undefined {
  return envVar?.split(',');
}

/**
 * Build content configuration from environment and preset
 */
function buildContentConfig(
  preset: (typeof FILTER_PRESETS)[keyof typeof FILTER_PRESETS]
): FilterConfig['content'] {
  return {
    excludeThinking: process.env.SUBAGENT_EXCLUDE_THINKING
      ? process.env.SUBAGENT_EXCLUDE_THINKING !== 'false'
      : preset.content.excludeThinking,
    excludeSystemReminders: getEnvBoolean(
      process.env.SUBAGENT_EXCLUDE_SYSTEM_REMINDERS,
      preset.content.excludeSystemReminders
    ),
    excludeErrors: getEnvBoolean(
      process.env.SUBAGENT_EXCLUDE_ERRORS,
      preset.content.excludeErrors
    ),
    customPatterns: getEnvStringArray(process.env.SUBAGENT_CUSTOM_PATTERNS),
  };
}

/**
 * Build sub-agents configuration from environment and preset
 */
function buildSubAgentsConfig(
  preset: (typeof FILTER_PRESETS)[keyof typeof FILTER_PRESETS]
): FilterConfig['subAgents'] {
  return {
    excludeCalls: process.env.SUBAGENT_EXCLUDE_SUBAGENT_CALLS
      ? process.env.SUBAGENT_EXCLUDE_SUBAGENT_CALLS !== 'false'
      : preset.subAgents.excludeCalls,
    excludeResponses: process.env.SUBAGENT_EXCLUDE_SUBAGENT_RESPONSES
      ? process.env.SUBAGENT_EXCLUDE_SUBAGENT_RESPONSES !== 'false'
      : preset.subAgents.excludeResponses,
  };
}

/**
 * Build tools configuration from environment and preset
 */
function buildToolsConfig(
  preset: (typeof FILTER_PRESETS)[keyof typeof FILTER_PRESETS]
): FilterConfig['tools'] {
  return {
    excludeCategories:
      (getEnvStringArray(
        process.env.SUBAGENT_EXCLUDE_TOOL_CATEGORIES
      ) as ToolCategory[]) ||
      (preset.tools.excludeCategories
        ? [...preset.tools.excludeCategories]
        : undefined),
    excludeSpecific:
      getEnvStringArray(process.env.SUBAGENT_EXCLUDE_TOOLS) ||
      (preset.tools.excludeSpecific
        ? [...preset.tools.excludeSpecific]
        : undefined),
    excludeCallsOnly: process.env.SUBAGENT_EXCLUDE_TOOL_CALLS_ONLY
      ? process.env.SUBAGENT_EXCLUDE_TOOL_CALLS_ONLY === 'true'
      : false,
    excludeResultsOnly: process.env.SUBAGENT_EXCLUDE_TOOL_RESULTS_ONLY
      ? process.env.SUBAGENT_EXCLUDE_TOOL_RESULTS_ONLY === 'true'
      : false,
    excludeFailed: getEnvBoolean(
      process.env.SUBAGENT_EXCLUDE_FAILED_TOOLS,
      preset.tools.excludeFailed ?? false
    ),
  };
}

/**
 * Build messages configuration from environment and preset
 */
function buildMessagesConfig(
  preset: (typeof FILTER_PRESETS)[keyof typeof FILTER_PRESETS]
): FilterConfig['messages'] {
  return {
    excludeEmpty: getEnvBoolean(
      process.env.SUBAGENT_EXCLUDE_EMPTY,
      preset.messages.excludeEmpty ?? false
    ),
    excludeByRole:
      getEnvStringArray(process.env.SUBAGENT_EXCLUDE_ROLES) ??
      ('excludeByRole' in preset.messages
        ? (preset.messages.excludeByRole as string[] | undefined)
        : undefined),
    maxLength: process.env.SUBAGENT_MAX_MESSAGE_LENGTH
      ? Number.parseInt(process.env.SUBAGENT_MAX_MESSAGE_LENGTH, 10)
      : undefined,
  };
}

/**
 * Get filter configuration based on preset name
 * @param presetName - The name of the filter preset to use (defaults to 'heavy')
 * @returns FilterConfig based on the preset
 */
export function getFilterConfig(presetName?: FilterPreset): FilterConfig {
  // Use provided preset or default to 'heavy'
  const selectedPreset = presetName || 'heavy';
  const preset =
    FILTER_PRESETS[selectedPreset as keyof typeof FILTER_PRESETS] ||
    FILTER_PRESETS.heavy;

  return {
    content: buildContentConfig(preset),
    subAgents: buildSubAgentsConfig(preset),
    tools: buildToolsConfig(preset),
    messages: buildMessagesConfig(preset),
    advanced: {
      preserveContext: process.env.SUBAGENT_PRESERVE_CONTEXT
        ? process.env.SUBAGENT_PRESERVE_CONTEXT !== 'false'
        : preset.advanced.preserveContext,
      compactMode: getEnvBoolean(
        process.env.SUBAGENT_COMPACT_MODE,
        preset.advanced.compactMode
      ),
    },
  };
}

/**
 * Get filter configuration from environment variables (backward compatibility)
 * @deprecated Use getFilterConfig() instead
 */
export function getFilterConfigFromEnv(): FilterConfig {
  return getFilterConfig();
}
