import { describe, expect, it } from 'vitest';
import {
  type GetConversationUpToUserMessageParams,
  type GetRecentConversationParams,
  getConversationUpToUserMessageSchema,
  getRecentConversationSchema,
} from '../../src/lib/validation';

describe('Validation Schemas', () => {
  describe('getRecentConversationSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        projectPath: '/path/to/project',
        limit: 50,
      };

      const result = getRecentConversationSchema.safeParse(validParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectPath).toBe('/path/to/project');
        expect(result.data.limit).toBe(50);
      }
    });

    it('should accept params without optional fields', () => {
      const result = getRecentConversationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectPath).toBeUndefined();
        expect(result.data.limit).toBe(100); // Default is applied by zod
      }
    });

    it('should reject invalid limit', () => {
      const invalidParams = {
        limit: 0, // min is 1
      };

      const result = getRecentConversationSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject limit over 1000', () => {
      const invalidParams = {
        limit: 1001,
      };

      const result = getRecentConversationSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should provide default value for limit when not specified', () => {
      const params = {};
      const result = getRecentConversationSchema.parse(params);
      // Default is applied by zod
      expect(result.limit).toBe(100);
    });
  });

  describe('getConversationUpToUserMessageSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        projectPath: '/path/to/project',
        userMessageIndex: 5,
      };

      const result =
        getConversationUpToUserMessageSchema.safeParse(validParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectPath).toBe('/path/to/project');
        expect(result.data.userMessageIndex).toBe(5);
      }
    });

    it('should require userMessageIndex', () => {
      const invalidParams = {
        projectPath: '/path/to/project',
      };

      const result =
        getConversationUpToUserMessageSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject userMessageIndex of 0', () => {
      const invalidParams = {
        userMessageIndex: 0,
      };

      const result =
        getConversationUpToUserMessageSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject negative userMessageIndex', () => {
      const invalidParams = {
        userMessageIndex: -1,
      };

      const result =
        getConversationUpToUserMessageSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('Type exports', () => {
    it('should export correct types', () => {
      // These are compile-time checks
      const recentParams: GetRecentConversationParams = {
        projectPath: '/test',
        limit: 100,
      };

      const upToUserParams: GetConversationUpToUserMessageParams = {
        userMessageIndex: 3,
        projectPath: '/test',
      };

      expect(recentParams).toBeDefined();
      expect(upToUserParams).toBeDefined();
    });
  });
});
