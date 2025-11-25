import { randomUUID } from 'crypto';

function uid() { try { return randomUUID(); } catch { return 'id-' + Math.random().toString(36).slice(2); } }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const { getSupabaseAdmin, getUserIdFromHeader } = await import('../_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);
  const body = req.body || {};
  try {
    if (admin && userId) {
      const { data, error } = await admin
        .from('saved_results')
        .insert({
          user_id: userId,
          tool_name: body.tool_name,
          input_data: body.input_data ?? {},
          results: body.results ?? {},
        })
        .select('id')
        .single();
      if (error) throw error;
      return res.status(200).json({ saved: data });
    }
    // Fallback (no persistence)
    return res.status(200).json({ saved: { id: uid() } });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
