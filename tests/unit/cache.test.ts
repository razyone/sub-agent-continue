import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConversationCache,
  clearGlobalCache,
  getCacheKey,
  getGlobalCache,
} from '../../src/lib/cache';
import type { ConversationEntry } from '../../src/types';

describe('ConversationCache', () => {
  let cache: ConversationCache;
  const mockEntry: ConversationEntry = {
    parentUuid: null,
    uuid: 'test-uuid',
    timestamp: '2024-01-01T00:00:00Z',
    type: 'user',
    message: { role: 'user', content: 'Test message' },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new ConversationCache(5, 10); // Small cache with 10s TTL for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create cache with default parameters', () => {
      const defaultCache = new ConversationCache();
      expect(defaultCache.size()).toBe(0);
    });

    it('should create cache with custom parameters', () => {
      const customCache = new ConversationCache(50, 7200);
      expect(customCache.size()).toBe(0);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve entries', () => {
      const entries = [mockEntry];
      cache.set('test-key', entries);

      const result = cache.get('test-key');
      expect(result).toEqual(entries);
      expect(cache.size()).toBe(1);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired entries', () => {
      const entries = [mockEntry];
      cache.set('test-key', entries);

      // Advance time beyond TTL
      vi.advanceTimersByTime(11_000);

      const result = cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle multiple entries', () => {
      const entries1 = [mockEntry];
      const entries2 = [{ ...mockEntry, uuid: 'test-uuid-2' }];

      cache.set('key1', entries1);
      cache.set('key2', entries2);

      expect(cache.get('key1')).toEqual(entries1);
      expect(cache.get('key2')).toEqual(entries2);
      expect(cache.size()).toBe(2);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('test-key', [mockEntry]);
      expect(cache.has('test-key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove entries', () => {
      cache.set('test-key', [mockEntry]);
      expect(cache.has('test-key')).toBe(true);

      cache.delete('test-key');
      expect(cache.has('test-key')).toBe(false);
      expect(cache.size()).toBe(0);
    });

    it('should handle deletion of non-existent keys', () => {
      cache.delete('non-existent');
      expect(cache.size()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', [mockEntry]);
      cache.set('key2', [mockEntry]);
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('invalidateByPrefix', () => {
    it('should remove entries with matching prefix', () => {
      cache.set('project1:file1', [mockEntry]);
      cache.set('project1:file2', [mockEntry]);
      cache.set('project2:file1', [mockEntry]);

      expect(cache.size()).toBe(3);

      cache.invalidateByPrefix('project1:');
      expect(cache.size()).toBe(1);
      expect(cache.has('project1:file1')).toBe(false);
      expect(cache.has('project1:file2')).toBe(false);
      expect(cache.has('project2:file1')).toBe(true);
    });

    it('should handle empty prefix gracefully', () => {
      cache.set('key1', [mockEntry]);
      cache.set('key2', [mockEntry]);

      cache.invalidateByPrefix('');
      expect(cache.size()).toBe(0);
    });

    it('should handle non-matching prefix', () => {
      cache.set('key1', [mockEntry]);
      cache.set('key2', [mockEntry]);

      cache.invalidateByPrefix('nonexistent:');
      expect(cache.size()).toBe(2);
    });
  });

  describe('LRU behavior', () => {
    it('should evict oldest entries when max size exceeded', () => {
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, [{ ...mockEntry, uuid: `uuid-${i}` }]);
      }
      expect(cache.size()).toBe(5);

      // Add one more to trigger eviction
      cache.set('key5', [{ ...mockEntry, uuid: 'uuid-5' }]);
      expect(cache.size()).toBe(5);

      // First entry should be evicted
      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key5')).toBe(true);
    });

    it('should update age on get', () => {
      cache.set('key1', [mockEntry]);
      cache.set('key2', [mockEntry]);
      cache.set('key3', [mockEntry]);
      cache.set('key4', [mockEntry]);
      cache.set('key5', [mockEntry]);

      // Access key1 to make it recently used
      cache.get('key1');

      // Add new entry to trigger eviction
      cache.set('key6', [mockEntry]);

      // key1 should still exist (was recently accessed)
      // key2 should be evicted (oldest unaccessed)
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });
  });
});

describe('Global Cache Functions', () => {
  afterEach(() => {
    clearGlobalCache();
  });

  describe('getGlobalCache', () => {
    it('should return the same instance on multiple calls', () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();
      expect(cache1).toBe(cache2);
    });

    it('should create new cache when global cache is null', () => {
      clearGlobalCache();
      const cache = getGlobalCache();
      expect(cache).toBeInstanceOf(ConversationCache);
    });
  });

  describe('clearGlobalCache', () => {
    it('should clear the global cache', () => {
      const cache = getGlobalCache();
      cache.set('test', [mockEntry]);
      expect(cache.size()).toBe(1);

      clearGlobalCache();
      expect(cache.size()).toBe(0);
    });

    it('should handle null global cache gracefully', () => {
      clearGlobalCache();
      expect(() => clearGlobalCache()).not.toThrow();
    });
  });
});

describe('getCacheKey', () => {
  it('should return file path when no suffix provided', () => {
    const result = getCacheKey('/path/to/file.jsonl');
    expect(result).toBe('/path/to/file.jsonl');
  });

  it('should combine file path and suffix', () => {
    const result = getCacheKey('/path/to/file.jsonl', 'recent:100');
    expect(result).toBe('/path/to/file.jsonl:recent:100');
  });

  it('should handle empty suffix', () => {
    const result = getCacheKey('/path/to/file.jsonl', '');
    expect(result).toBe('/path/to/file.jsonl:');
  });
});

const mockEntry: ConversationEntry = {
  parentUuid: null,
  uuid: 'test-uuid',
  timestamp: '2024-01-01T00:00:00Z',
  type: 'user',
  message: { role: 'user', content: 'Test message' },
};
