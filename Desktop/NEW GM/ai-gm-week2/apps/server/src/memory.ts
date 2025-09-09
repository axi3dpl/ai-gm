export type Memory = {
  threadId: string;
  entries: string[];
};

const store = new Map<string, string[]>();

export function addPlayerMessage(threadId: string, content: string) {
  if (!store.has(threadId)) {
    store.set(threadId, []);
  }
  const arr = store.get(threadId)!;
  arr.push(content);
  if (arr.length > 50) {
    arr.splice(0, arr.length - 50); // keep last 50 messages
  }
}

export function getMemorySummary(threadId: string): string {
  const arr = store.get(threadId);
  if (!arr || arr.length === 0) return '';
  return arr.join('\n');
}

export function clearMemory(threadId: string) {
  store.delete(threadId);
}
