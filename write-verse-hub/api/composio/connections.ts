import { getConnectedAccounts } from '../_lib/composio.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ message: 'NO_USER_ID' });

  try {
    const result = await getConnectedAccounts(String(userId));
    if (!result.success) {
      return res.status(400).json({ message: result.error || 'Failed to fetch connections', accounts: [] });
    }
    return res.status(200).json({ accounts: result.accounts || [] });
  } catch (e: any) {
    return res.status(500).json({ message: String(e?.message || e), accounts: [] });
  }
}
