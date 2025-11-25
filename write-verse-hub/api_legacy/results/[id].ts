export default async function handler(req: any, res: any) {
  const { getSupabaseAdmin, getUserIdFromHeader } = await import('../../_lib/supabase.js');
  const admin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);
  const { id } = req.query as { id?: string };

  if (req.method === 'DELETE') {
    try {
      if (admin && userId && id) {
        const { error } = await admin
          .from('saved_results')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message || 'Internal error' });
    }
  }

  res.setHeader('Allow', 'DELETE');
  return res.status(405).json({ message: 'Method not allowed' });
}
