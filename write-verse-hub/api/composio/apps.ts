import { getAvailableApps } from '../_lib/composio.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const result = await getAvailableApps();
    return res.status(200).json({ apps: result.apps || [] });
  } catch (e: any) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
