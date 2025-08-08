export type MessageContent =
  | string
  | Array<{
      type: string;
      text?: string;
      content?: string;
      name?: string;
      id?: string;
      input?: unknown;
      tool_use_id?: string;
    }>;

export interface ConversationEntry {
  parentUuid: string | null;
  uuid: string;
  timestamp: string;
  type: 'user' | 'assistant';
  message: {
    role: string;
    content: MessageContent;
  };
  toolUseResult?: unknown;
}

export interface ConversationFile {
  path: string;
  sessionId: string;
  mtime: Date;
}

export interface ConversationNode extends ConversationEntry {
  children: ConversationNode[];
}

export interface MCPConfig {
  server?: {
    host?: string;
    port?: number;
  };
  cache?: {
    enabled?: boolean;
    maxSize?: string;
    ttl?: number;
  };
  filtering?: {
    excludeToolResults?: boolean;
    excludeSystemMessages?: boolean;
    maxMessageLength?: number;
  };
  projects?: {
    basePath?: string;
    allowedPaths?: string[];
  };
}

export type FilterPreset =
  | 'none'
  | 'light'
  | 'heavy'
  | 'smart'
  | 'minimal'
  | 'moderate'
  | 'aggressive'
  | 'development';

export interface ToolParams {
  getCurrentConversation: {
    projectPath?: string;
    filterPreset?: FilterPreset;
  };
  getCurrentConversationUpto: {
    projectPath?: string;
    userMessageIndex: number;
    filterPreset?: FilterPreset;
  };
}
