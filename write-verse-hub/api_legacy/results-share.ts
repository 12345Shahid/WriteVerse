export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { getSupabaseAdmin, getUserIdFromHeader } = await import('./_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);
  const { id } = req.body || {} as { id?: string };

  if (!id) return res.status(400).json({ message: 'Missing id' });

  try {
    const slug = `r-${id}`;
    if (admin && userId) {
      const { data, error } = await admin
        .from('saved_results')
        .update({ is_public: true, public_slug: slug })
        .eq('id', id)
        .eq('user_id', userId)
        .select('public_slug')
        .single();
      if (error) throw error;
      return res.status(200).json({ public_slug: data?.public_slug || slug });
    }
    // Fallback (no persistence)
    return res.status(200).json({ public_slug: slug });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
