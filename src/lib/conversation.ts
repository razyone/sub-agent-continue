import type { ConversationEntry, ConversationNode } from '../types/index.js';

export function buildConversationTree(
  entries: ConversationEntry[]
): ConversationNode[] {
  const nodeMap = new Map<string, ConversationNode>();
  const roots: ConversationNode[] = [];

  for (const entry of entries) {
    const node: ConversationNode = {
      ...entry,
      children: [],
    };
    nodeMap.set(entry.uuid, node);
  }

  for (const entry of entries) {
    const node = nodeMap.get(entry.uuid);
    if (!node) {
      continue;
    }

    if (entry.parentUuid) {
      const parent = nodeMap.get(entry.parentUuid);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function flattenConversationTree(
  nodes: ConversationNode[]
): ConversationEntry[] {
  const result: ConversationEntry[] = [];

  function traverse(node: ConversationNode) {
    const { children, ...entry } = node;
    result.push(entry);
    for (const child of children) {
      traverse(child);
    }
  }

  for (const root of nodes) {
    traverse(root);
  }

  return result;
}

export function sortByTimestamp(
  entries: ConversationEntry[]
): ConversationEntry[] {
  return [...entries].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
}

export function getMostRecentBranch(
  nodes: ConversationNode[]
): ConversationEntry[] {
  if (nodes.length === 0) {
    return [];
  }

  const currentNode = nodes.at(-1);
  const branch: ConversationEntry[] = [];

  function collectBranch(node: ConversationNode) {
    const { children, ...entry } = node;
    branch.push(entry);

    if (children.length > 0) {
      const lastChild = children.at(-1);
      if (lastChild) {
        collectBranch(lastChild);
      }
    }
  }

  if (currentNode) {
    collectBranch(currentNode);
  }
  return branch;
}
