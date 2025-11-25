import { getCommonHeaders } from './api';

const API_PREFIX = '/api';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  tasks: { count: number }[];
  created_at: string;
  tags?: { id: string; name: string; color: string }[];
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee_id: string | null;
  assignee?: { email: string };
  due_date: string | null;
  created_at: string;
  tags?: { id: string; name: string; color: string }[];
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${API_PREFIX}/projects`, {
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to list projects');
  const data = await res.json();
  return data.projects || [];
}

export async function createProject(name: string, description: string): Promise<Project> {
  const res = await fetch(`${API_PREFIX}/projects`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error('Failed to create project');
  const data = await res.json();
  return data.project;
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_PREFIX}/projects/${id}`, {
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get project');
  const data = await res.json();
  return data.project;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const res = await fetch(`${API_PREFIX}/projects/${id}`, {
    method: 'PATCH',
    headers: await getCommonHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update project');
  const data = await res.json();
  return data.project;
}

export async function listTasks(projectId: string): Promise<Task[]> {
  const res = await fetch(`${API_PREFIX}/projects/${projectId}/tasks`, {
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to list tasks');
  const data = await res.json();
  return data.tasks || [];
}

export async function createTask(projectId: string, task: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_PREFIX}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to create task');
  const data = await res.json();
  return data.task;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_PREFIX}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: await getCommonHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update task');
  const data = await res.json();
  return data.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

export async function listTaskAssets(taskId: string): Promise<any[]> {
  const res = await fetch(`${API_PREFIX}/tasks/${taskId}/assets`, { headers: await getCommonHeaders() });
  if (!res.ok) throw new Error('Failed to list task assets');
  const data = await res.json();
  return data.assets;
}

export async function attachAsset(taskId: string, assetId: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/tasks/${taskId}/assets`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify({ assetId })
  });
  if (!res.ok) throw new Error('Failed to attach asset');
}

export async function detachAsset(taskId: string, assetId: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/tasks/${taskId}/assets/${assetId}`, {
    method: 'DELETE',
    headers: await getCommonHeaders()
  });
  if (!res.ok) throw new Error('Failed to detach asset');
}
