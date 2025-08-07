import { z } from 'zod';

// Schema for getRecentConversation
export const getRecentConversationSchema = z.object({
  projectPath: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100).optional(),
});

// Schema for getConversationUpToUserMessage
export const getConversationUpToUserMessageSchema = z.object({
  projectPath: z.string().optional(),
  userMessageIndex: z.number().min(1),
});

// Export types
export type GetRecentConversationParams = z.infer<
  typeof getRecentConversationSchema
>;
export type GetConversationUpToUserMessageParams = z.infer<
  typeof getConversationUpToUserMessageSchema
>;
