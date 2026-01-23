import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getUserIdFromHeader } from '../supabaseAdmin.js';

const TRIAL_CREDITS = 7000;
const TRIAL_DAYS = 14;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const userId = getUserIdFromHeader(req);

  // GET: Fetch subscription status
  if (req.method === 'GET') {
    const { organizationId } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return res.json({ subscription: data || null });
    } catch (err: any) {
      console.error('[API][subscriptions] GET error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Start trial
  if (req.method === 'POST') {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const path = url.pathname;

    // POST /api/subscriptions/start-trial
    if (path.endsWith('/start-trial')) {
      const { organizationId, plan } = req.body;

      if (!organizationId || !plan) {
        return res.status(400).json({ error: 'organizationId and plan required' });
      }

      if (!['starter', 'professional', 'business'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan' });
      }

      try {
        // Check if subscription already exists
        const { data: existing } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('id')
          .eq('organization_id', organizationId)
          .single();

        if (existing) {
          return res.status(400).json({ error: 'Subscription already exists' });
        }

        // Calculate trial end date
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

        // Create subscription record
        const { data: subscription, error: subError } = await supabaseAdmin
          .from('organization_subscriptions')
          .insert({
            organization_id: organizationId,
            plan: plan,
            status: 'trialing',
            trial_ends_at: trialEndsAt.toISOString(),
            monthly_credits: TRIAL_CREDITS
          })
          .select()
          .single();

        if (subError) throw subError;

        // Add trial credits to organization
        const { error: creditsError } = await supabaseAdmin
          .from('organization_credits')
          .upsert({
            organization_id: organizationId,
            balance_credits: TRIAL_CREDITS
          }, {
            onConflict: 'organization_id'
          });

        if (creditsError) {
          console.warn('[API][subscriptions] Credits upsert warning:', creditsError);
        }

        console.log('[API][subscriptions] Trial started:', { organizationId, plan, trialEndsAt });

        return res.json({
          success: true,
          subscription,
          message: `Trial started! You have ${TRIAL_DAYS} days and ${TRIAL_CREDITS} credits.`
        });
      } catch (err: any) {
        console.error('[API][subscriptions] start-trial error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
