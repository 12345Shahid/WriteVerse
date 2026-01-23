import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const TRIAL_CREDITS = 7000;
const TRIAL_DAYS = 7;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { organizationId, plan } = req.body;

  if (!organizationId || !plan) {
    return res.status(400).json({ error: 'organizationId and plan required' });
  }

  if (!['starter', 'professional', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Must be starter, professional, or business.' });
  }

  try {
    // Check if subscription already exists
    const { data: existing } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, status')
      .eq('organization_id', organizationId)
      .single();

    if (existing) {
      return res.status(400).json({ 
        error: 'Subscription already exists',
        existingStatus: existing.status
      });
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
      console.warn('[API][start-trial] Credits upsert warning:', creditsError);
    }

    console.log('[API][start-trial] Trial started:', { 
      organizationId, 
      plan, 
      trialEndsAt: trialEndsAt.toISOString(),
      credits: TRIAL_CREDITS 
    });

    return res.json({
      success: true,
      subscription,
      message: `Trial started! You have ${TRIAL_DAYS} days and ${TRIAL_CREDITS} credits.`
    });
  } catch (err: any) {
    console.error('[API][start-trial] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
