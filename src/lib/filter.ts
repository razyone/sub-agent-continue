import type { ConversationEntry, MessageContent } from '../types/index.js';
import {
  type FilterConfig,
  getFilterConfigFromEnv,
  TOOL_CATEGORIES,
} from './filter-config.js';

/**
 * Enhanced filtering system with comprehensive configuration
 */

// Types for better type safety
type MessageContentItem = {
  type: string;
  text?: string;
  content?: string;
  name?: string;
  id?: string;
  input?: unknown;
  tool_use_id?: string;
  is_error?: boolean;
};

interface ToolUseResult {
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
}

/**
 * Remove content patterns (thinking blocks, system reminders, etc.)
 */
function filterContentPatterns(
  content: MessageContent,
  config: FilterConfig
): MessageContent {
  if (!content) {
    return content;
  }

  let result = content;

  // Convert to string for processing if needed
  const processString = (str: string): string => {
    let processed = str;

    processed = removeThinkingBlocks(processed, config);
    processed = removeSystemReminders(processed, config);
    processed = applyCustomPatterns(processed, config);
    processed = truncateIfNeeded(processed, config);

    return processed.trim();
  };

  if (typeof result === 'string') {
    result = processString(result);
  } else if (Array.isArray(result)) {
    result = processArrayContent(
      result,
      processString,
      config
    ) as MessageContent;
  }

  return result;
}

/**
 * Helper functions for content processing
 */
function removeThinkingBlocks(processed: string, config: FilterConfig): string {
  if (!config.content.excludeThinking) {
    return processed;
  }
  return processed
    .replace(/<anythingllm:thinking>[\s\S]*?<\/anythingllm:thinking>/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
}

function removeSystemReminders(
  processed: string,
  config: FilterConfig
): string {
  if (!config.content.excludeSystemReminders) {
    return processed;
  }
  return processed.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
}

function applyCustomPatterns(processed: string, config: FilterConfig): string {
  if (!config.content.customPatterns) {
    return processed;
  }

  let result = processed;
  for (const pattern of config.content.customPatterns) {
    try {
      const regex = new RegExp(pattern, 'g');
      result = result.replace(regex, '');
    } catch (_e) {
      // Invalid regex, skip
    }
  }
  return result;
}

function truncateIfNeeded(processed: string, config: FilterConfig): string {
  if (
    !config.messages.maxLength ||
    processed.length <= config.messages.maxLength
  ) {
    return processed;
  }
  return `${processed.substring(0, config.messages.maxLength)}...[truncated]`;
}

function processArrayContent(
  content: MessageContentItem[],
  processString: (str: string) => string,
  config: FilterConfig
): MessageContentItem[] {
  return content
    .map((item) => processContentItem(item, processString))
    .filter((item) => shouldKeepContentItem(item, config));
}

function processContentItem(
  item: MessageContentItem,
  processString: (str: string) => string
): MessageContentItem {
  // Handle text content
  if (item.text && typeof item.text === 'string') {
    return { ...item, text: processString(item.text) };
  }

  // Handle tool_use items with input content
  if (item.type === 'tool_use' && item.input) {
    const newInput = { ...item.input } as Record<string, unknown>;
    for (const [key, value] of Object.entries(newInput)) {
      if (typeof value === 'string') {
        newInput[key] = processString(value);
      }
    }
    return { ...item, input: newInput };
  }

  // Handle tool_result items
  if (item.type === 'tool_result' && typeof item.content === 'string') {
    return { ...item, content: processString(item.content) };
  }

  return item;
}

function shouldKeepContentItem(
  item: MessageContentItem,
  config: FilterConfig
): boolean {
  if (!config.messages.excludeEmpty) {
    return true;
  }

  if (item.text && typeof item.text === 'string') {
    return item.text.length > 0;
  }

  return true;
}

/**
 * Check if entry is a tool call
 */
function isToolCall(entry: ConversationEntry, toolName?: string): boolean {
  if (entry.type !== 'assistant') {
    return false;
  }

  const content = entry.message.content;
  if (Array.isArray(content)) {
    return content.some((item) => {
      if (item.type === 'tool_use') {
        return toolName ? item.name === toolName : true;
      }
      return false;
    });
  }

  return false;
}

/**
 * Get tool name from assistant message
 */
function getToolName(entry: ConversationEntry): string | null {
  if (entry.type !== 'assistant') {
    return null;
  }

  const content = entry.message.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'tool_use' && item.name) {
        return item.name as string;
      }
    }
  }

  return null;
}

/**
 * Check if entry is a tool result
 */
function isToolResult(entry: ConversationEntry): boolean {
  if (entry.type !== 'user') {
    return false;
  }

  const content = entry.message.content;
  if (Array.isArray(content)) {
    return content.some((item) => item.type === 'tool_result');
  }

  return false;
}

/**
 * Check if tool result is an error
 */
function isFailedToolResult(entry: ConversationEntry): boolean {
  if (!isToolResult(entry)) {
    return false;
  }

  const content = entry.message.content;
  if (Array.isArray(content)) {
    return content.some((item) => {
      if (item.type === 'tool_result') {
        // Check for error flag or error content
        const hasErrorFlag = (item as MessageContentItem).is_error === true;
        const hasErrorContent =
          typeof item.content === 'string' &&
          item.content.includes('[Request interrupted');
        return hasErrorFlag || hasErrorContent;
      }
      return false;
    });
  }

  return false;
}

/**
 * Check if this is a sub-agent call
 */
function isSubAgentCall(entry: ConversationEntry): boolean {
  return isToolCall(entry, 'Task');
}

/**
 * Check if this is a sub-agent response
 */
function isSubAgentResponse(entry: ConversationEntry): boolean {
  if (entry.type !== 'user') {
    return false;
  }

  if (entry.toolUseResult) {
    const result = entry.toolUseResult as ToolUseResult;
    return !!(
      result.totalDurationMs &&
      result.totalTokens &&
      typeof result.totalToolUseCount === 'number'
    );
  }

  return false;
}

/**
 * Should filter this tool based on configuration
 */
function shouldFilterTool(toolName: string, config: FilterConfig): boolean {
  // Check specific tools
  if (config.tools.excludeSpecific?.includes(toolName)) {
    return true;
  }

  // Check categories
  if (
    config.tools.excludeCategories &&
    config.tools.excludeCategories.length > 0
  ) {
    const category = TOOL_CATEGORIES[toolName];
    if (category && config.tools.excludeCategories.includes(category)) {
      return true;
    }
  }

  return false;
}

/**
 * Main filtering function
 */
export function filterConversation(
  entries: ConversationEntry[],
  config?: FilterConfig
): ConversationEntry[] {
  const filterConfig = config || getFilterConfigFromEnv();

  // Track tool calls to handle paired call/response filtering
  const toolCallMap = new Map<string, string>(); // uuid -> toolName
  const filteredUuids = new Set<string>();

  // First pass: identify what to filter
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }

    processSubAgentFiltering(entry, filterConfig, filteredUuids);
    processToolCallFiltering(entry, filterConfig, filteredUuids, toolCallMap);
    processToolResultFiltering(
      entry,
      entries,
      index,
      filterConfig,
      filteredUuids,
      toolCallMap
    );
    processRoleFiltering(entry, filterConfig, filteredUuids);
  }

  // Second pass: filter and process
  return entries
    .filter((entry) => !filteredUuids.has(entry.uuid))
    .map((entry) => {
      // Filter content patterns
      const filteredContent = filterContentPatterns(
        entry.message.content,
        filterConfig
      );

      // Check if message is now empty
      if (filterConfig.messages.excludeEmpty) {
        if (typeof filteredContent === 'string' && !filteredContent) {
          return null;
        }
        if (Array.isArray(filteredContent) && filteredContent.length === 0) {
          return null;
        }
      }

      // Return modified entry
      return {
        ...entry,
        message: {
          ...entry.message,
          content: filteredContent,
        },
      };
    })
    .filter((entry): entry is ConversationEntry => entry !== null);
}

/**
 * Helper functions for filtering logic
 */
function processSubAgentFiltering(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  filteredUuids: Set<string>
): void {
  if (filterConfig.subAgents.excludeCalls && isSubAgentCall(entry)) {
    filteredUuids.add(entry.uuid);
  }

  if (filterConfig.subAgents.excludeResponses && isSubAgentResponse(entry)) {
    filteredUuids.add(entry.uuid);
  }
}

function processToolCallFiltering(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  filteredUuids: Set<string>,
  toolCallMap: Map<string, string>
): void {
  if (!isToolCall(entry)) {
    return;
  }

  const toolName = getToolName(entry);
  if (!toolName) {
    return;
  }

  toolCallMap.set(entry.uuid, toolName);

  if (
    shouldFilterTool(toolName, filterConfig) &&
    !filterConfig.tools.excludeResultsOnly
  ) {
    filteredUuids.add(entry.uuid);
  }
}

function processToolResultFiltering(
  entry: ConversationEntry,
  entries: ConversationEntry[],
  index: number,
  filterConfig: FilterConfig,
  filteredUuids: Set<string>,
  toolCallMap: Map<string, string>
): void {
  if (!isToolResult(entry)) {
    return;
  }

  // Find corresponding tool call
  const prevEntry = entries[index - 1];
  if (prevEntry && toolCallMap.has(prevEntry.uuid)) {
    const toolName = toolCallMap.get(prevEntry.uuid);
    if (
      toolName &&
      shouldFilterTool(toolName, filterConfig) &&
      !filterConfig.tools.excludeCallsOnly
    ) {
      filteredUuids.add(entry.uuid);
    }
  }

  // Filter failed tools if configured
  if (filterConfig.tools.excludeFailed && isFailedToolResult(entry)) {
    filteredUuids.add(entry.uuid);
  }
}

function processRoleFiltering(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  filteredUuids: Set<string>
): void {
  if (filterConfig.messages.excludeByRole?.includes(entry.type)) {
    filteredUuids.add(entry.uuid);
  }
}

/**
 * Get statistics about what would be filtered
 */
export function getFilterStatistics(
  entries: ConversationEntry[],
  config?: FilterConfig
): {
  total: number;
  filtered: number;
  byCategory: {
    thinking: number;
    subAgentCalls: number;
    subAgentResponses: number;
    tools: number;
    failed: number;
  };
  tokensSaved: number; // Approximate
} {
  const filterConfig = config || getFilterConfigFromEnv();
  const filtered = filterConversation(entries, filterConfig);

  const stats = {
    total: entries.length,
    filtered: entries.length - filtered.length,
    byCategory: {
      thinking: 0,
      subAgentCalls: 0,
      subAgentResponses: 0,
      tools: 0,
      failed: 0,
    },
    tokensSaved: 0,
  };

  for (const entry of entries) {
    updateThinkingStats(entry, filterConfig, stats);
    updateSubAgentStats(entry, filterConfig, stats);
    updateToolStats(entry, filterConfig, stats);
    updateFailedToolStats(entry, filterConfig, stats);
  }

  return stats;
}

/**
 * Helper functions for statistics calculation
 */
function updateThinkingStats(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  stats: { byCategory: Record<string, number>; tokensSaved: number }
): void {
  if (!filterConfig.content.excludeThinking) {
    return;
  }

  const content = JSON.stringify(entry.message.content);
  if (content.includes('thinking>')) {
    stats.byCategory.thinking = (stats.byCategory.thinking || 0) + 1;
    stats.tokensSaved += 100; // Rough estimate
  }
}

function updateSubAgentStats(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  stats: { byCategory: Record<string, number>; tokensSaved: number }
): void {
  if (isSubAgentCall(entry) && filterConfig.subAgents.excludeCalls) {
    stats.byCategory.subAgentCalls = (stats.byCategory.subAgentCalls || 0) + 1;
    stats.tokensSaved += 150;
  }

  if (isSubAgentResponse(entry) && filterConfig.subAgents.excludeResponses) {
    stats.byCategory.subAgentResponses =
      (stats.byCategory.subAgentResponses || 0) + 1;
    const result = entry.toolUseResult as ToolUseResult;
    stats.tokensSaved += result?.totalTokens || 5000;
  }
}

function updateToolStats(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  stats: { byCategory: Record<string, number>; tokensSaved: number }
): void {
  if (!isToolCall(entry)) {
    return;
  }

  const toolName = getToolName(entry);
  if (toolName && shouldFilterTool(toolName, filterConfig)) {
    stats.byCategory.tools = (stats.byCategory.tools || 0) + 1;
    stats.tokensSaved += 200;
  }
}

function updateFailedToolStats(
  entry: ConversationEntry,
  filterConfig: FilterConfig,
  stats: { byCategory: Record<string, number>; tokensSaved: number }
): void {
  if (isFailedToolResult(entry) && filterConfig.tools.excludeFailed) {
    stats.byCategory.failed = (stats.byCategory.failed || 0) + 1;
    stats.tokensSaved += 50;
  }
}
