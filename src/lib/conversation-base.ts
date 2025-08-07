import type { ConversationEntry } from '../types/index.js';
import { getCacheKey, getGlobalCache } from './cache.js';
import { findMostRecentConversation } from './file-system.js';
import { filterConversation } from './filter.js';
import { getFilterConfigFromEnv } from './filter-config.js';
import { parseConversationFile } from './parser.js';
import { createEmptyConversationXML, toXML } from './xml.js';

export interface ConversationOptions {
  projectPath?: string;
  cacheKeySuffix?: string;
  processEntries?: (entries: ConversationEntry[]) => ConversationEntry[];
  emptyMessage?: string;
}

/**
 * Base function for retrieving and processing conversation entries
 * Handles common operations: finding files, caching, parsing, filtering, and XML conversion
 */
export function getConversationBase(options: ConversationOptions): string {
  try {
    const { projectPath, cacheKeySuffix, processEntries, emptyMessage } =
      options;

    // Find the most recent conversation file
    const conversationFile = findMostRecentConversation(projectPath);
    if (!conversationFile) {
      return createEmptyConversationXML(
        'No conversations found for this project'
      );
    }

    // Get entries from cache or parse file
    const cache = getGlobalCache();
    const cacheKey = getCacheKey(conversationFile.path, cacheKeySuffix);

    let entries = cache.get(cacheKey);
    if (!entries) {
      entries = parseConversationFile(conversationFile.path);
      cache.set(cacheKey, entries);
    }

    // Process entries if a processor function is provided
    let entriesToFilter = entries;
    if (processEntries) {
      entriesToFilter = processEntries(entries);

      // Check if processing resulted in empty entries
      if (entriesToFilter.length === 0 && emptyMessage) {
        return createEmptyConversationXML(emptyMessage);
      }
    }

    // Apply filters to the conversation
    const filterConfig = getFilterConfigFromEnv();
    const filteredEntries = filterConversation(entriesToFilter, filterConfig);

    // Convert to XML
    return toXML(filteredEntries, {
      sessionId: conversationFile.sessionId,
      projectPath: projectPath || process.cwd(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(errorMessage);
  }
}

/**
 * Helper function to exclude entries from the last user message onwards
 */
export function excludeLastUserMessage(
  entries: ConversationEntry[]
): ConversationEntry[] {
  if (entries.length === 0) {
    return entries;
  }

  // Find the index of the last user message
  let lastUserMessageIndex = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.type === 'user') {
      lastUserMessageIndex = i;
      break;
    }
  }

  // Exclude entries from the last user message onwards
  if (lastUserMessageIndex >= 0) {
    return entries.slice(0, lastUserMessageIndex);
  }

  return entries;
}
