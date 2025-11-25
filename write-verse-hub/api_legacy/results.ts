import { randomUUID } from 'crypto';

function uid() { try { return randomUUID(); } catch { return 'id-' + Math.random().toString(36).slice(2); } }

export default async function handler(req: any, res: any) {
  const { getSupabaseAdmin, getUserIdFromHeader } = await import('./_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);

  if (req.method === 'GET') {
    if (admin && userId) {
      try {
        const { data, error } = await admin
          .from('saved_results')
          .select('id,tool_name,input_data,results,created_at,is_public,public_slug')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ results: data || [] });
      } catch (e: any) {
        return res.status(200).json({ results: [] });
      }
    }
    return res.status(200).json({ results: [] });
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).json({ message: 'Method not allowed' });
}
