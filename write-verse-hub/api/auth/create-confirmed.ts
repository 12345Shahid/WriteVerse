export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing email or password' });
    }

    const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
    if (!baseUrl || !serviceKey) {
      return res.status(500).json({ message: 'Server not configured' });
    }

    const endpoint = `${baseUrl}/auth/v1/admin/users`;
    const payload: any = {
      email,
      password,
      email_confirm: true,
    };
    if (name) payload.user_metadata = { name };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify(payload),
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 409 || /already/i.test(String(json?.message || ''))) {
        const getResp = await fetch(`${endpoint}?email=${encodeURIComponent(email)}`, {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        });
        const getJson = await getResp.json().catch(() => null);
        const user = Array.isArray(getJson?.users) ? getJson.users[0] : getJson || null;
        const userId = (user as any)?.id;
        if (getResp.ok && userId) {
          const patch = await fetch(`${endpoint}?id=${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
            },
            body: JSON.stringify({ email_confirm: true }),
          });
          const patchJson = await patch.json().catch(() => null);
          if (!patch.ok) {
            return res
              .status(patch.status)
              .json({ message: 'Admin PATCH error', details: patchJson });
          }
          return res.status(200).json({ user: patchJson });
        }
      }
      return res.status(r.status).json({ message: 'Admin API error', details: json });
    }
    return res.status(200).json({ user: json });
  } catch (e: any) {
    console.error('[API][auth/create-confirmed] error', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
