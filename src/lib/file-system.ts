import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ConversationFile } from '../types/index.js';

const SLASH_REGEX = /\//g;
const TRAILING_DASH_REGEX = /-+$/;

export function getProjectFolder(projectPath?: string): string {
  const basePath = join(homedir(), '.claude', 'projects');

  if (!projectPath) {
    const cwd = process.cwd();
    const sanitized = cwd
      .replace(SLASH_REGEX, '-')
      .replace(TRAILING_DASH_REGEX, '');
    return join(basePath, sanitized);
  }

  const sanitized = projectPath
    .replace(SLASH_REGEX, '-')
    .replace(TRAILING_DASH_REGEX, '');
  return join(basePath, sanitized);
}

export function findConversations(projectFolder: string): ConversationFile[] {
  if (!existsSync(projectFolder)) {
    return [];
  }

  try {
    const files = readdirSync(projectFolder)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => {
        const fullPath = join(projectFolder, f);
        const stats = statSync(fullPath);
        return {
          path: fullPath,
          sessionId: f.replace('.jsonl', ''),
          mtime: stats.mtime,
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files;
  } catch (_error) {
    // Error finding conversations
    return [];
  }
}

export function findMostRecentConversation(
  projectPath?: string
): ConversationFile | null {
  const projectFolder = getProjectFolder(projectPath);
  const conversations = findConversations(projectFolder);

  if (conversations.length === 0) {
    return null;
  }

  return conversations[0] ?? null;
}

export function readJSONLFile(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .filter((line) => {
        try {
          JSON.parse(line);
          return true;
        } catch {
          return false;
        }
      });
  } catch (_error) {
    // Error reading JSONL file
    return [];
  }
}

export function isPathAllowed(
  projectPath: string,
  allowedPaths: string[] = ['*']
): boolean {
  if (allowedPaths.includes('*')) {
    return true;
  }

  const resolvedPath = resolve(projectPath);
  return allowedPaths.some((allowed) => {
    const resolvedAllowed = resolve(allowed);
    return resolvedPath.startsWith(resolvedAllowed);
  });
}

export function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .trim();
}
