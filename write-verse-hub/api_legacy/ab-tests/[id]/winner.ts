export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const { getSupabaseAdmin, getUserIdFromHeader } = await import('../../../_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);
  const { id } = req.query as { id?: string };
  const { winner } = req.body || {};

  if (winner !== 'A' && winner !== 'B') {
    return res.status(400).json({ message: 'Invalid winner' });
  }

  try {
    if (admin && userId && id) {
      const { data, error } = await admin
        .from('ab_tests')
        .update({ winner })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return res.status(200).json({ test: data });
    }
    return res.status(200).json({ test: { id, winner } });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
