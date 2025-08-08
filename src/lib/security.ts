import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, normalize, resolve } from 'node:path';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size
const CLAUDE_BASE_PATH = resolve(homedir(), '.claude');

export function validateFilePath(filePath: string): void {
  const normalizedPath = normalize(resolve(filePath));

  if (!normalizedPath.startsWith(CLAUDE_BASE_PATH)) {
    throw new Error('Access denied: Path must be within ~/.claude directory');
  }

  if (normalizedPath.includes('..')) {
    throw new Error('Access denied: Path traversal detected');
  }
}

export function validateFileSize(filePath: string): void {
  try {
    const stats = statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${stats.size} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes`
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, which is fine
      return;
    }
    throw error;
  }
}

export function sanitizeProjectPath(projectPath: string): string {
  // Remove any path traversal attempts
  const sanitized = projectPath
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
    .replace(/\0/g, ''); // Remove null bytes

  if (isAbsolute(sanitized)) {
    throw new Error('Project path must be relative, not absolute');
  }

  return sanitized;
}
