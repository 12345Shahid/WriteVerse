export default async function handler(req: any, res: any) {
  try {
    const { getSupabaseAdmin, getUserIdFromHeader } = await import('./_lib/supabase.js');
    const userId = getUserIdFromHeader(req);
    const admin = getSupabaseAdmin();

    if (admin && userId) {
      try {
        const { data, error } = await admin
          .from('users')
          .select('monthly_token_limit,tokens_used_this_month,credits_balance,credits_lifetime,email,subscription_tier')
          .eq('id', userId)
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      } catch {
        // fall through to default
      }
    }

    return res.status(200).json({
      monthly_token_limit: 5000,
      tokens_used_this_month: 0,
      credits_balance: 500,
      credits_lifetime: 500,
      email: null,
      subscription_tier: 'free',
    });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
