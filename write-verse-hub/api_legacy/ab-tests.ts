export default async function handler(req: any, res: any) {
  const { getSupabaseAdmin, getUserIdFromHeader } = await import('./_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);

  if (req.method === 'GET') {
    if (admin && userId) {
      try {
        const { data } = await admin
          .from('ab_tests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        return res.status(200).json({ tests: data || [] });
      } catch {
        return res.status(200).json({ tests: [] });
      }
    }
    return res.status(200).json({ tests: [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (admin && userId) {
      try {
        const { data, error } = await admin
          .from('ab_tests')
          .insert({
            user_id: userId,
            tool_name: body.tool_name,
            input_summary: body.input_summary || null,
            variant_a: body.variant_a,
            variant_b: body.variant_b,
          })
          .select('*')
          .single();
        if (error) throw error;
        return res.status(200).json({ test: data });
      } catch (e: any) {
        return res.status(500).json({ message: e?.message || 'Internal error' });
      }
    }
    return res.status(200).json({ test: { id: 'ab-test-dev' } });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ message: 'Method not allowed' });
}
