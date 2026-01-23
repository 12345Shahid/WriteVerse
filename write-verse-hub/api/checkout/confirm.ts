import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { sessionId } = req.body;
  const userId = req.headers['x-user-id'];

  if (!sessionId) {
    return res.status(400).json({ error: 'MISSING_SESSION_ID' });
  }

  if (!userId) {
    console.warn('[API][checkout/confirm] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('[API][checkout/confirm] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    console.log('[API][checkout/confirm] Confirming session:', sessionId);

    // Call the fulfill_checkout function to process the payment
    const { data, error } = await supabaseAdmin.rpc('fulfill_checkout', {
      session_id: sessionId,
    });

    if (error) {
      console.error('[API][checkout/confirm] fulfill_checkout error:', error);
      return res.status(500).json({ error: 'FULFILL_ERROR', message: error.message });
    }

    console.log('[API][checkout/confirm] Result:', data);

    // Check if already confirmed or successful
    if (data?.status === 'already_completed') {
      return res.status(200).json({
        ok: true,
        alreadyConfirmed: true,
      });
    }

    if (data?.error) {
      return res.status(400).json({
        ok: false,
        error: data.error,
      });
    }

    // Success - return the new balance
    return res.status(200).json({
      ok: true,
      credits_added: data?.credits_added || 0,
      new_balance: data?.new_balance || 0,
    });
  } catch (e: any) {
    console.error('[API][checkout/confirm] Error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: e?.message || 'Unknown error' });
  }
}
