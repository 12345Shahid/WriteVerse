import { healthCheck } from '../_lib/composio.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const health = await healthCheck();
    return res.status(200).json(health);
  } catch (e: any) {
    return res.status(200).json({
      status: 'error',
      enabled: !!process.env.COMPOSIO_API_KEY,
      reason: String(e?.message || e),
    });
  }
}
