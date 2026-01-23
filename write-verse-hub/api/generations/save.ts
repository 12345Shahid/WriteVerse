// API to save user generations (blogs, images)
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  try {
    const { type, title, content, imageUrl, prompt, model, metadata } = req.body;

    if (!type || !['blog', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type', message: 'Type must be blog or image' });
    }

    const { data, error } = await supabase
      .from('user_generations')
      .insert({
        user_id: userId,
        type,
        title: title || null,
        content: content || null,
        image_url: imageUrl || null,
        prompt: prompt || null,
        model: model || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    console.log('[API][generations/save] Saved generation:', { id: data.id, type, userId });
    
    return res.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('[API][generations/save] Error:', err);
    return res.status(500).json({ error: 'SAVE_FAILED', message: err.message });
  }
}
