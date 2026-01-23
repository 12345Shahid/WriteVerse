// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string | undefined;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const supabaseAdmin = supabaseUrl && supabaseServiceRole
  ? createClient(supabaseUrl, supabaseServiceRole)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  const headerVal = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  const userId = typeof headerVal === 'string' && headerVal.trim().length > 0 ? headerVal.trim() : null;
  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  try {
    let data: any = null;
    try {
      const res1 = await supabaseAdmin
        .from('users')
        .select('monthly_token_limit, tokens_used_this_month, credits_balance, credits_lifetime, email, subscription_tier')
        .eq('id', userId)
        .single();
      if (res1.error) throw res1.error;
      data = res1.data;
    } catch (e) {
      const res2 = await supabaseAdmin
        .from('users')
        .select('monthly_token_limit, tokens_used_this_month, email, subscription_tier')
        .eq('id', userId)
        .single();
      if (res2.error) throw res2.error;
      data = {
        ...res2.data,
        credits_balance: null,
        credits_lifetime: null,
      };
    }

    return res.json({
      monthly_token_limit: data?.monthly_token_limit ?? 0,
      tokens_used_this_month: data?.tokens_used_this_month ?? 0,
      credits_balance: data?.credits_balance ?? null,
      credits_lifetime: data?.credits_lifetime ?? null,
      email: data?.email ?? null,
      subscription_tier: data?.subscription_tier ?? null,
    });
  } catch (err: any) {
    console.error('[Profile] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
