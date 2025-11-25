import { getCommonHeaders } from './api';

const API_PREFIX = '/api';

export interface ChatThread {
  id: string;
  organization_id: string;
  topic: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_user?: { email: string };
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  user_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  user?: { email: string };
}

export async function listThreads(): Promise<ChatThread[]> {
  const res = await fetch(`${API_PREFIX}/chat/threads`, { headers: await getCommonHeaders() });
  if (!res.ok) throw new Error('Failed to list threads');
  const data = await res.json();
  return data.threads || [];
}

export async function createThread(topic: string): Promise<ChatThread> {
  const res = await fetch(`${API_PREFIX}/chat/threads`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error('Failed to create thread');
  const data = await res.json();
  return data.thread;
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_PREFIX}/chat/threads/${threadId}/messages`, { headers: await getCommonHeaders() });
  if (!res.ok) throw new Error('Failed to list messages');
  const data = await res.json();
  return data.messages || [];
}

export async function sendMessage(threadId: string, content: string): Promise<ChatMessage> {
  const res = await fetch(`${API_PREFIX}/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  const data = await res.json();
  return data.message;
}
