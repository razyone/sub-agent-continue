import {
  excludeLastUserMessage,
  getConversationBase,
} from '../lib/conversation-base.js';
import { measure } from '../lib/performance.js';
import { createErrorXML } from '../lib/xml.js';
import type { ToolParams } from '../types/index.js';

// biome-ignore lint/suspicious/useAwait: MCP SDK requires async functions
export async function getCurrentConversation(
  params: ToolParams['getCurrentConversation']
): Promise<string> {
  return measure('getCurrentConversation', () => {
    try {
      const { projectPath } = params;

      return getConversationBase({
        projectPath,
        cacheKeySuffix: 'full',
        processEntries: excludeLastUserMessage,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return createErrorXML(
        `Failed to get current conversation: ${errorMessage}`
      );
    }
  });
}

export const getCurrentConversationSchema = {
  name: 'getCurrentConversation',
  description:
    'Get the entire conversation from a Claude Code project with smart filtering (excludes the last user message to avoid sub-agents seeing their trigger)',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description:
          'Project path to get conversation from (defaults to current directory)',
      },
    },
  },
};
