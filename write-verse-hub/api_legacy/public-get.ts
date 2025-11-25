export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { getSupabaseAdmin } = await import('./_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const { slug } = req.query as { slug?: string };

  if (!slug) return res.status(400).json({ message: 'Missing slug' });

  if (!admin) {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const { data } = await admin
      .from('saved_results')
      .select('id,tool_name,input_data,results,created_at,public_slug')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .single();
    if (!data) return res.status(404).json({ message: 'Not found' });
    return res.status(200).json({ result: data });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
