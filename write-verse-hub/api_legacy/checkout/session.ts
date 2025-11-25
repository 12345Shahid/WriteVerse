export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const amountUsd = Number(req.body?.amountUsd || 0);
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) {
    return res.status(400).json({ message: 'Stripe is not configured' });
  }
  try {
    const Stripe = (await import('stripe')).default as any;
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' as any });
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host as string;
    const base = `${proto}://${host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.max(100, Math.round(amountUsd * 100)),
          product_data: { name: `${amountUsd} USD Credits` },
        },
      }],
      success_url: `${base}/dashboard`,
      cancel_url: `${base}/dashboard`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Stripe error' });
  }
}
