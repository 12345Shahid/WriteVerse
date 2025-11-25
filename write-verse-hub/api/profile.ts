export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Fully static profile response – no Supabase calls, no possibility of 500.
  // This mirrors the legacy api_legacy/profile.ts default for a free user.
  console.log('[API][profile] Returning static default profile');
  return res.status(200).json({
    monthly_token_limit: 5000,
    tokens_used_this_month: 0,
    credits_balance: 500,
    credits_lifetime: 500,
    email: null,
    subscription_tier: 'free',
  });
}
