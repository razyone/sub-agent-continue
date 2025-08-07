import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findConversations,
  findMostRecentConversation,
  getProjectFolder,
  isPathAllowed,
  readJSONLFile,
  sanitizePath,
} from '../../src/lib/file-system';

// Mock the modules
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('node:path');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockHomedir = vi.mocked(homedir);
const mockJoin = vi.mocked(join);
const mockResolve = vi.mocked(resolve);

describe('File System Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup common mocks
    mockHomedir.mockReturnValue('/home/user');
    mockJoin.mockImplementation((...args) => args.join('/'));
    mockResolve.mockImplementation((arg) => `/resolved${arg}`);

    // Mock process.cwd
    const originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue('/current/working/dir');

    return () => {
      process.cwd = originalCwd;
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProjectFolder', () => {
    it('should return sanitized current directory path when no projectPath provided', () => {
      const result = getProjectFolder();

      expect(mockHomedir).toHaveBeenCalled();
      expect(mockJoin).toHaveBeenCalledWith(
        '/home/user',
        '.claude',
        'projects'
      );
      expect(result).toBe('/home/user/.claude/projects/-current-working-dir');
    });

    it('should return sanitized project path when provided', () => {
      const result = getProjectFolder('/custom/project/path');

      expect(result).toBe('/home/user/.claude/projects/-custom-project-path');
    });

    it('should replace slashes with dashes', () => {
      const result = getProjectFolder('/path/with/many/slashes');

      expect(result).toBe(
        '/home/user/.claude/projects/-path-with-many-slashes'
      );
    });

    it('should keep leading dashes from original path', () => {
      const result = getProjectFolder('-leading-dash-path');

      expect(result).toBe('/home/user/.claude/projects/-leading-dash-path');
    });

    it('should handle complex path sanitization', () => {
      const result = getProjectFolder('/-complex//path/-with-issues/');

      expect(result).toBe(
        '/home/user/.claude/projects/--complex--path--with-issues'
      );
    });
  });

  describe('findConversations', () => {
    it('should return empty array when directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = findConversations('/nonexistent/path');

      expect(result).toEqual([]);
      expect(mockExistsSync).toHaveBeenCalledWith('/nonexistent/path');
    });

    it('should return sorted conversation files by modification time', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'session1.jsonl',
        'session2.jsonl',
        'other.txt',
      ] as any);

      const mockStats1 = { mtime: new Date('2024-01-01T10:00:00Z') };
      const mockStats2 = { mtime: new Date('2024-01-01T11:00:00Z') };

      mockStatSync
        .mockReturnValueOnce(mockStats1 as any)
        .mockReturnValueOnce(mockStats2 as any);

      mockJoin
        .mockReturnValueOnce('/project/session1.jsonl')
        .mockReturnValueOnce('/project/session2.jsonl');

      const result = findConversations('/project');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: '/project/session2.jsonl',
        sessionId: 'session2',
        mtime: mockStats2.mtime,
      });
      expect(result[1]).toEqual({
        path: '/project/session1.jsonl',
        sessionId: 'session1',
        mtime: mockStats1.mtime,
      });
    });

    it('should filter only .jsonl files', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'session1.jsonl',
        'readme.md',
        'session2.jsonl',
        'config.json',
      ] as any);

      const mockStats = { mtime: new Date('2024-01-01T10:00:00Z') };
      mockStatSync.mockReturnValue(mockStats as any);

      mockJoin
        .mockReturnValueOnce('/project/session1.jsonl')
        .mockReturnValueOnce('/project/session2.jsonl');

      const result = findConversations('/project');

      expect(result).toHaveLength(2);
      expect(result.every((f) => f.path.endsWith('.jsonl'))).toBe(true);
    });

    it('should handle read errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = findConversations('/project');

      expect(result).toEqual([]);
    });

    it('should handle stat errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['session1.jsonl'] as any);
      mockStatSync.mockImplementation(() => {
        throw new Error('Stat error');
      });

      const result = findConversations('/project');

      expect(result).toEqual([]);
    });
  });

  describe('findMostRecentConversation', () => {
    it('should return the most recent conversation', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'session1.jsonl',
        'session2.jsonl',
      ] as any);

      const recentStats = { mtime: new Date('2024-01-01T11:00:00Z') };
      const olderStats = { mtime: new Date('2024-01-01T10:00:00Z') };

      mockStatSync
        .mockReturnValueOnce(olderStats as any)
        .mockReturnValueOnce(recentStats as any);

      const result = findMostRecentConversation('/custom/path');

      expect(result).toEqual({
        path: '/home/user/.claude/projects/-custom-path/session2.jsonl',
        sessionId: 'session2',
        mtime: recentStats.mtime,
      });
    });

    it('should return null when no conversations found', () => {
      mockExistsSync.mockReturnValue(false);

      const result = findMostRecentConversation('/custom/path');

      expect(result).toBeNull();
    });

    it('should use current directory when no path provided', () => {
      mockExistsSync.mockReturnValue(false);

      const result = findMostRecentConversation();

      expect(result).toBeNull();
      expect(process.cwd).toHaveBeenCalled();
    });
  });

  describe('readJSONLFile', () => {
    it('should return empty array when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = readJSONLFile('/nonexistent.jsonl');

      expect(result).toEqual([]);
    });

    it('should parse valid JSONL content', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{"uuid":"1","content":"first"}\n{"uuid":"2","content":"second"}\n\n{"uuid":"3","content":"third"}'
      );

      const result = readJSONLFile('/test.jsonl');

      expect(result).toEqual([
        '{"uuid":"1","content":"first"}',
        '{"uuid":"2","content":"second"}',
        '{"uuid":"3","content":"third"}',
      ]);
    });

    it('should filter out empty lines', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{"uuid":"1"}\n\n   \n{"uuid":"2"}\n');

      const result = readJSONLFile('/test.jsonl');

      expect(result).toEqual(['{"uuid":"1"}', '{"uuid":"2"}']);
    });

    it('should filter out invalid JSON lines', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{"uuid":"1"}\ninvalid json\n{"uuid":"2"}'
      );

      const result = readJSONLFile('/test.jsonl');

      expect(result).toEqual(['{"uuid":"1"}', '{"uuid":"2"}']);
    });

    it('should handle read errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = readJSONLFile('/test.jsonl');

      expect(result).toEqual([]);
    });

    it('should handle encoding properly', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{"test":"data"}');

      readJSONLFile('/test.jsonl');

      expect(mockReadFileSync).toHaveBeenCalledWith('/test.jsonl', 'utf-8');
    });
  });

  describe('isPathAllowed', () => {
    beforeEach(() => {
      mockResolve.mockImplementation((p) => `/resolved/${p}`);
    });

    it('should return true when wildcard is in allowed paths', () => {
      const result = isPathAllowed('/any/path', ['*']);

      expect(result).toBe(true);
    });

    it('should return true when path starts with allowed path', () => {
      const result = isPathAllowed('/project/subdir', ['/project']);

      expect(result).toBe(true);
      expect(mockResolve).toHaveBeenCalledWith('/project/subdir');
      expect(mockResolve).toHaveBeenCalledWith('/project');
    });

    it('should return false when path does not start with any allowed path', () => {
      const result = isPathAllowed('/forbidden/path', ['/allowed']);

      expect(result).toBe(false);
    });

    it('should handle multiple allowed paths', () => {
      mockResolve
        .mockReturnValueOnce('/resolved/test/path')
        .mockReturnValueOnce('/resolved/allowed1')
        .mockReturnValueOnce('/resolved/allowed2');

      const result = isPathAllowed('/test/path', ['/allowed1', '/allowed2']);

      expect(result).toBe(false);
    });

    it('should return true when at least one allowed path matches', () => {
      mockResolve
        .mockReturnValueOnce('/resolved/test/path')
        .mockReturnValueOnce('/resolved/different')
        .mockReturnValueOnce('/resolved/test');

      const result = isPathAllowed('/test/path', ['/different', '/test']);

      expect(result).toBe(true);
    });

    it('should use wildcard as default', () => {
      const result = isPathAllowed('/any/path');

      expect(result).toBe(true);
    });
  });

  describe('sanitizePath', () => {
    it('should remove .. patterns', () => {
      const result = sanitizePath('/path/../to/../file');

      expect(result).toBe('/path/to/file');
    });

    it('should replace double slashes with single slash', () => {
      const result = sanitizePath('/path//to///file');

      expect(result).toBe('/path/to/file');
    });

    it('should replace backslashes with forward slashes', () => {
      const result = sanitizePath('\\path\\to\\file');

      expect(result).toBe('/path/to/file');
    });

    it('should trim whitespace', () => {
      const result = sanitizePath('  /path/to/file  ');

      expect(result).toBe('/path/to/file');
    });

    it('should handle complex sanitization', () => {
      const result = sanitizePath('  \\path/..//to\\\\file..  ');

      expect(result).toBe('/path/to/file');
    });

    it('should handle empty string', () => {
      const result = sanitizePath('');

      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const result = sanitizePath('   ');

      expect(result).toBe('');
    });
  });
});
