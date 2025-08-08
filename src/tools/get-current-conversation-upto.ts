import { getConversationBase } from '../lib/conversation-base.js';
import { getUpToUserMessage } from '../lib/parser.js';
import { measure } from '../lib/performance.js';
import { createEmptyConversationXML, createErrorXML } from '../lib/xml.js';
import type { ToolParams } from '../types/index.js';

// biome-ignore lint/suspicious/useAwait: MCP SDK requires async functions
export async function getCurrentConversationUpto(
  params: ToolParams['getCurrentConversationUpto']
): Promise<string> {
  return measure('getCurrentConversationUpto', () => {
    try {
      const { projectPath, userMessageIndex, filterPreset } = params;

      // Validate user message index
      if (userMessageIndex <= 0) {
        return createEmptyConversationXML(
          'User message index must be greater than 0'
        );
      }

      return getConversationBase({
        projectPath,
        filterPreset,
        processEntries: (entries) =>
          getUpToUserMessage(entries, userMessageIndex),
        emptyMessage: `No messages found before user message ${userMessageIndex}`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return createErrorXML(
        `Failed to get conversation up to user message: ${errorMessage}`
      );
    }
  });
}

export const getCurrentConversationUptoSchema = {
  name: 'getCurrentConversationUpto',
  description:
    'Get conversation messages up to (but not including) the nth user message',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description:
          'Project path to get conversation from (defaults to current directory)',
      },
      userMessageIndex: {
        type: 'number',
        description:
          'Get messages up to (but not including) this user message number',
        minimum: 1,
      },
      filterPreset: {
        type: 'string',
        enum: ['none', 'light', 'heavy'],
        description:
          'Filter preset to apply: none (no filtering), light (skip reasoning only), heavy (skip reasoning + sub-agents). Defaults to heavy.',
      },
    },
    required: ['userMessageIndex'],
  },
};
