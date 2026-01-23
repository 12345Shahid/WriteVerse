import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Record a usage event and deduct credits.
 * @param {Object} event
 * @param {string} event.organization_id
 * @param {string} event.user_id
 * @param {string} event.tool
 * @param {string} event.provider
 * @param {string} event.action
 * @param {number} event.units
 * @param {number} event.credits
 * @param {Object} [event.metadata]
 * @returns {Promise<{organization_id: string, balance_credits: number} | null>}
 */
export async function recordUsage({ 
  organization_id, 
  user_id, 
  tool, 
  provider, 
  action, 
  units, 
  credits, 
  metadata = {} 
}) {
  try {
    if (!supabaseAdmin) {
      console.warn('[Meter] Supabase Admin not configured');
      return null;
    }
    
    console.log(`[Meter] Recording usage for ${tool}: ${credits} credits`);

    const { data, error } = await supabaseAdmin.rpc('record_usage', {
      p_organization_id: organization_id,
      p_user_id: user_id,
      p_tool: tool,
      p_provider: provider,
      p_action: action,
      p_units: units,
      p_credits: credits,
      p_metadata: metadata,
    });

    if (error) {
      console.warn('[Meter] RPC error', error.message);
      return null;
    }
    
    // RPC returns an array of rows (or null if no return)
    // record_usage returns TABLE (organization_id, balance_credits)
    const row = Array.isArray(data) ? data[0] : data;
    return row; 
  } catch (err) {
    console.warn('[Meter] Exception', err.message);
    return null;
  }
}
