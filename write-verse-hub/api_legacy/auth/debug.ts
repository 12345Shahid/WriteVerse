export default async function handler(req: any, res: any) {
  try {
    const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';

    const env = {
      hasSupabaseUrl: !!baseUrl,
      hasServiceRole: !!serviceKey,
    };

    let adminPing: { ok: boolean; status: number; note?: string } = { ok: false, status: 0 };
    if (env.hasSupabaseUrl && env.hasServiceRole) {
      const endpoint = `${baseUrl}/auth/v1/admin/users?limit=1`;
      try {
        const r = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        });
        adminPing = { ok: r.ok, status: r.status, note: r.ok ? 'Admin API reachable' : 'Admin API denied' };
      } catch (e: any) {
        adminPing = { ok: false, status: 0, note: e?.message || 'fetch failed' };
      }
    } else {
      adminPing = { ok: false, status: 0, note: 'Missing envs' };
    }

    return res.status(200).json({ env, adminPing });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
