import { getCommonHeaders } from './api';

const API_PREFIX = '/api';

export interface BrandVoice {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  tone_tags: string[];
  rules: { dos: string[]; donts: string[] };
  created_by: string;
  created_at: string;
  updated_at: string;
  brand_voice_samples?: BrandVoiceSample[];
}

export interface BrandVoiceSample {
  id: string;
  voice_id: string;
  content: string;
  created_at: string;
}

export async function listBrandVoices(): Promise<BrandVoice[]> {
  const res = await fetch(`${API_PREFIX}/brand-voices`, { headers: await getCommonHeaders() });
  if (!res.ok) throw new Error('Failed to list brand voices');
  const data = await res.json();
  return data.voices || [];
}

export async function getBrandVoice(id: string): Promise<BrandVoice> {
  const res = await fetch(`${API_PREFIX}/brand-voices/${id}`, { headers: await getCommonHeaders() });
  if (!res.ok) throw new Error('Failed to get brand voice');
  const data = await res.json();
  return data.voice;
}

export async function createBrandVoice(data: Partial<BrandVoice>): Promise<BrandVoice> {
  const res = await fetch(`${API_PREFIX}/brand-voices`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create brand voice');
  const json = await res.json();
  return json.voice;
}

export async function updateBrandVoice(id: string, data: Partial<BrandVoice>): Promise<BrandVoice> {
  const res = await fetch(`${API_PREFIX}/brand-voices/${id}`, {
    method: 'PUT',
    headers: await getCommonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update brand voice');
  const json = await res.json();
  return json.voice;
}

export async function deleteBrandVoice(id: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/brand-voices/${id}`, {
    method: 'DELETE',
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete brand voice');
}

export async function addVoiceSample(voiceId: string, content: string): Promise<BrandVoiceSample> {
  const res = await fetch(`${API_PREFIX}/brand-voices/${voiceId}/samples`, {
    method: 'POST',
    headers: await getCommonHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to add sample');
  const json = await res.json();
  return json.sample;
}

export async function deleteVoiceSample(voiceId: string, sampleId: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/brand-voices/${voiceId}/samples/${sampleId}`, {
    method: 'DELETE',
    headers: await getCommonHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete sample');
}
