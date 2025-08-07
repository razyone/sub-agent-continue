import { LRUCache } from 'lru-cache';
import type { ConversationEntry } from '../types/index.js';

interface CacheEntry {
  entries: ConversationEntry[];
  timestamp: number;
}

export class ConversationCache {
  private cache: LRUCache<string, CacheEntry>;
  private ttl: number;

  constructor(maxSize = 100, ttlSeconds = 3600) {
    this.ttl = ttlSeconds * 1000;
    this.cache = new LRUCache<string, CacheEntry>({
      max: maxSize,
      ttl: this.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  get(key: string): ConversationEntry[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.entries;
  }

  set(key: string, entries: ConversationEntry[]): void {
    this.cache.set(key, {
      entries,
      timestamp: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

let globalCache: ConversationCache | null = null;

export function getGlobalCache(): ConversationCache {
  if (!globalCache) {
    globalCache = new ConversationCache();
  }
  return globalCache;
}

export function clearGlobalCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}

export function getCacheKey(filePath: string, suffix?: string): string {
  return suffix !== undefined ? `${filePath}:${suffix}` : filePath;
}
