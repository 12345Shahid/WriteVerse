import Stripe from 'stripe';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const amountUsd = Number(req.body?.amountUsd || 0);
  const key = process.env.STRIPE_SECRET_KEY || '';
  const userId = req.headers['x-user-id'];

  if (!key) {
    console.error('[API][checkout/session] STRIPE_SECRET_KEY not configured');
    return res.status(400).json({ message: 'Stripe is not configured' });
  }

  if (!userId) {
    console.warn('[API][checkout/session] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('[API][checkout/session] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  const amountCents = Math.max(100, Math.round(amountUsd * 100));
  const creditsPerUsd = 1000;
  const creditsToAdd = Math.max(1, Math.round(amountUsd * creditsPerUsd));

  try {
    // 1. Create pending transaction in database
    console.log('[API][checkout/session] Creating credits_transactions row', {
      userId,
      amountCents,
      creditsToAdd,
    });

    const { data: tx, error: txError } = await supabaseAdmin
      .from('credits_transactions')
      .insert({
        user_id: userId,
        amount_cents: amountCents,
        credits_added: creditsToAdd,
        status: 'pending',
      })
      .select('*')
      .single();

    if (txError) {
      console.error('[API][checkout/session] Failed to insert credits_transactions', txError);
      return res.status(500).json({ error: 'TX_INSERT_FAILED', message: String(txError?.message || txError) });
    }

    // 2. Create Stripe checkout session
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' as any });
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host as string;
    const base = `${proto}://${host}`;

    console.log('[API][checkout/session] Creating Stripe Checkout Session');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: { name: `${amountUsd} USD Credits` },
          },
        },
      ],
      metadata: {
        user_id: String(userId),
        credits_tx_id: String(tx.id),
      },
      success_url: `${base}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard?checkout_canceled=1`,
    });

    // 3. Link Stripe session ID to our transaction
    try {
      await supabaseAdmin
        .from('credits_transactions')
        .update({ stripe_session_id: session.id })
        .eq('id', tx.id);
      console.log('[API][checkout/session] Linked Stripe session to credits_transactions', {
        txId: tx.id,
        stripeSessionId: session.id,
      });
    } catch (linkError) {
      console.warn('[API][checkout/session] Failed to update credits_transactions with stripe_session_id', linkError);
    }

    console.log('[API][checkout/session] Success, returning session.url');
    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error('[API][checkout/session] Stripe error', e);
    return res.status(500).json({ message: e?.message || 'Stripe error' });
  }
}
