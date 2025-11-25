import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][health] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][health] Creating Supabase admin client');
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdminClient;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const supabaseAdmin = getSupabaseAdmin();

  return res.status(200).json({
    ok: true,
    service: 'WriterAI backend (Vercel)',
    geminiReady: hasGemini,
    supabaseReady: !!supabaseAdmin,
    time: new Date().toISOString(),
  });
}
