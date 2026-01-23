import { getCommonHeaders } from './api';

const API_PREFIX = '/api';

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  placeholder?: string;
  options?: string[]; // For select
}

export interface ContentTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  schema: TemplateField[];
  prompt_text: string;
  created_at: string;
}

export async function listTemplates(): Promise<ContentTemplate[]> {
  const res = await fetch(`${API_PREFIX}/templates`, { headers: await getCommonHeaders() });
  if (!res.ok) throw new Error('Failed to list templates');
  const data = await res.json();
  return data.templates || [];
}

export async function createTemplate(template: Partial<ContentTemplate>): Promise<ContentTemplate> {
  const res = await fetch(`${API_PREFIX}/templates`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new Error('Failed to create template');
  const data = await res.json();
  return data.template;
}

export async function updateTemplate(id: string, template: Partial<ContentTemplate>): Promise<ContentTemplate> {
  const res = await fetch(`${API_PREFIX}/templates/${id}`, {
    method: 'PUT',
    headers: await getCommonHeaders(),
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new Error('Failed to update template');
  const data = await res.json();
  return data.template;
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/templates/${id}`, {
    method: 'DELETE',
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete template');
}

export async function generateFromTemplate(templateId: string, inputs: Record<string, any>, brandVoiceId?: string): Promise<any[]> {
  const res = await fetch(`${API_PREFIX}/generate-template`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify({ templateId, inputs, brandVoiceId }),
  });
  if (!res.ok) throw new Error('Failed to generate');
  const data = await res.json();
  return data.results;
}
