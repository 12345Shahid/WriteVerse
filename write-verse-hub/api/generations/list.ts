// API to fetch user generations
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  try {
    const type = req.query.type as string; // 'blog' or 'image' or undefined (all)
    const limit = parseInt(req.query.limit as string) || 20;

    let query = supabase
      .from('user_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type && ['blog', 'image'].includes(type)) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json({ 
      success: true, 
      generations: data || [],
      count: data?.length || 0
    });
  } catch (err: any) {
    console.error('[API][generations/list] Error:', err);
    return res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
}
