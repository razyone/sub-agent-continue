import { describe, expect, it } from 'vitest';
import {
  buildConversationTree,
  flattenConversationTree,
  getMostRecentBranch,
  sortByTimestamp,
} from '../../src/lib/conversation';
import type { ConversationEntry } from '../../src/types';

describe('Conversation Tree Functions', () => {
  const mockEntries: ConversationEntry[] = [
    {
      parentUuid: null,
      uuid: 'root-1',
      timestamp: '2024-01-01T10:00:00Z',
      type: 'user',
      message: { role: 'user', content: 'First message' },
    },
    {
      parentUuid: 'root-1',
      uuid: 'child-1',
      timestamp: '2024-01-01T10:01:00Z',
      type: 'assistant',
      message: { role: 'assistant', content: 'Response to first' },
    },
    {
      parentUuid: 'child-1',
      uuid: 'grandchild-1',
      timestamp: '2024-01-01T10:02:00Z',
      type: 'user',
      message: { role: 'user', content: 'Follow up' },
    },
    {
      parentUuid: null,
      uuid: 'root-2',
      timestamp: '2024-01-01T11:00:00Z',
      type: 'user',
      message: { role: 'user', content: 'Another root' },
    },
    {
      parentUuid: 'nonexistent-parent',
      uuid: 'orphan',
      timestamp: '2024-01-01T12:00:00Z',
      type: 'user',
      message: { role: 'user', content: 'Orphaned message' },
    },
  ];

  describe('buildConversationTree', () => {
    it('should build tree with proper parent-child relationships', () => {
      const tree = buildConversationTree(mockEntries);

      expect(tree).toHaveLength(3); // 2 roots + 1 orphan

      // Find root-1
      const root1 = tree.find((node) => node.uuid === 'root-1');
      expect(root1).toBeDefined();
      expect(root1?.children).toHaveLength(1);
      expect(root1?.children[0]?.uuid).toBe('child-1');
      expect(root1?.children[0]?.children).toHaveLength(1);
      expect(root1?.children[0]?.children[0]?.uuid).toBe('grandchild-1');

      // Find root-2
      const root2 = tree.find((node) => node.uuid === 'root-2');
      expect(root2).toBeDefined();
      expect(root2?.children).toHaveLength(0);

      // Find orphan
      const orphan = tree.find((node) => node.uuid === 'orphan');
      expect(orphan).toBeDefined();
      expect(orphan?.children).toHaveLength(0);
    });

    it('should handle empty entries', () => {
      const tree = buildConversationTree([]);
      expect(tree).toHaveLength(0);
    });

    it('should handle single entry', () => {
      const singleEntry: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: 'single',
          timestamp: '2024-01-01T10:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Single message' },
        },
      ];

      const tree = buildConversationTree(singleEntry);
      expect(tree).toHaveLength(1);
      expect(tree[0]?.uuid).toBe('single');
      expect(tree[0]?.children).toHaveLength(0);
    });
  });

  describe('flattenConversationTree', () => {
    it('should flatten tree back to entries', () => {
      const tree = buildConversationTree(mockEntries);
      const flattened = flattenConversationTree(tree);

      expect(flattened).toHaveLength(mockEntries.length);

      // Check that all entries are present (order may differ)
      const uuids = flattened.map((entry) => entry.uuid);
      expect(uuids).toContain('root-1');
      expect(uuids).toContain('child-1');
      expect(uuids).toContain('grandchild-1');
      expect(uuids).toContain('root-2');
      expect(uuids).toContain('orphan');
    });

    it('should maintain entry structure without children property', () => {
      const tree = buildConversationTree(mockEntries.slice(0, 2));
      const flattened = flattenConversationTree(tree);

      expect(flattened[0]).not.toHaveProperty('children');
      expect(flattened[0]).toHaveProperty('uuid');
      expect(flattened[0]).toHaveProperty('message');
    });

    it('should handle empty tree', () => {
      const flattened = flattenConversationTree([]);
      expect(flattened).toHaveLength(0);
    });

    it('should traverse in depth-first order', () => {
      const tree = buildConversationTree(mockEntries.slice(0, 3));
      const flattened = flattenConversationTree(tree);

      // Should be root-1, child-1, grandchild-1 in that order
      expect(flattened[0]?.uuid).toBe('root-1');
      expect(flattened[1]?.uuid).toBe('child-1');
      expect(flattened[2]?.uuid).toBe('grandchild-1');
    });
  });

  describe('getMostRecentBranch', () => {
    it('should get the most recent branch', () => {
      const tree = buildConversationTree(mockEntries);
      const branch = getMostRecentBranch(tree);

      // Should start with the last root (root-2 or orphan based on order)
      expect(branch).toHaveLength(1);
      expect(['root-2', 'orphan']).toContain(branch[0]?.uuid);
    });

    it('should follow chain to deepest child', () => {
      const chainEntries: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: 'root',
          timestamp: '2024-01-01T10:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Root' },
        },
        {
          parentUuid: 'root',
          uuid: 'child1',
          timestamp: '2024-01-01T10:01:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Child 1' },
        },
        {
          parentUuid: 'root',
          uuid: 'child2',
          timestamp: '2024-01-01T10:02:00Z',
          type: 'assistant',
          message: { role: 'assistant', content: 'Child 2' },
        },
        {
          parentUuid: 'child2',
          uuid: 'grandchild',
          timestamp: '2024-01-01T10:03:00Z',
          type: 'user',
          message: { role: 'user', content: 'Grandchild' },
        },
      ];

      const tree = buildConversationTree(chainEntries);
      const branch = getMostRecentBranch(tree);

      expect(branch).toHaveLength(3); // root -> child2 -> grandchild
      expect(branch[0]?.uuid).toBe('root');
      expect(branch[1]?.uuid).toBe('child2'); // Should take the last child
      expect(branch[2]?.uuid).toBe('grandchild');
    });

    it('should handle empty tree', () => {
      const branch = getMostRecentBranch([]);
      expect(branch).toHaveLength(0);
    });
  });

  describe('sortByTimestamp', () => {
    it('should sort entries by timestamp ascending', () => {
      const unsorted: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: 'third',
          timestamp: '2024-01-01T12:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Third' },
        },
        {
          parentUuid: null,
          uuid: 'first',
          timestamp: '2024-01-01T10:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'First' },
        },
        {
          parentUuid: null,
          uuid: 'second',
          timestamp: '2024-01-01T11:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Second' },
        },
      ];

      const sorted = sortByTimestamp(unsorted);
      expect(sorted[0]?.uuid).toBe('first');
      expect(sorted[1]?.uuid).toBe('second');
      expect(sorted[2]?.uuid).toBe('third');
    });

    it('should not mutate original array', () => {
      const original = [...mockEntries];
      const sorted = sortByTimestamp(original);

      expect(original).toEqual(mockEntries);
      expect(sorted).not.toBe(original);
    });

    it('should handle empty array', () => {
      const sorted = sortByTimestamp([]);
      expect(sorted).toHaveLength(0);
    });

    it('should handle invalid timestamps gracefully', () => {
      const entriesWithInvalidTimestamp: ConversationEntry[] = [
        {
          parentUuid: null,
          uuid: 'valid',
          timestamp: '2024-01-01T10:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Valid' },
        },
        {
          parentUuid: null,
          uuid: 'invalid',
          timestamp: 'invalid-date',
          type: 'user',
          message: { role: 'user', content: 'Invalid' },
        },
      ];

      // Should not throw an error
      expect(() => sortByTimestamp(entriesWithInvalidTimestamp)).not.toThrow();
    });
  });
});
