# Stripe Webhook Setup Guide

This guide explains how to configure Stripe webhooks so that credits are automatically updated after payments.

---

## Why Webhooks Are Required

Without webhooks:
- Credits won't be added when monthly subscriptions renew
- One-time purchases may fail if the user closes the browser before confirmation
- Subscription status changes (cancellations, past due) won't sync

---

## 1. Database Setup

Before configuring webhooks, run the SQL migration to add the helper function:

```sql
-- Run this in Supabase SQL Editor
-- File: sql/SQL51_add_monthly_credits.sql

CREATE OR REPLACE FUNCTION public.add_monthly_credits(
  p_organization_id uuid,
  p_credits integer
)
RETURNS TABLE (
  organization_id uuid,
  balance_credits bigint
) AS $$
DECLARE 
  v_balance bigint;
BEGIN
  INSERT INTO public.organization_credits(organization_id) 
  VALUES (p_organization_id)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.organization_credits
  SET balance_credits = organization_credits.balance_credits + p_credits,
      updated_at = now()
  WHERE organization_credits.organization_id = p_organization_id
  RETURNING organization_credits.balance_credits INTO v_balance;

  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, -p_credits, 'Monthly subscription credits');

  RETURN QUERY SELECT p_organization_id, v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. Create Webhook Endpoint in Stripe

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)

2. Click **"Add endpoint"**

3. Enter your webhook URL:
   - **Production**: `https://yourdomain.com/api/webhooks/stripe`
   - **Preview deployments**: Use Stripe CLI for local testing

4. Select the following events:
   - `checkout.session.completed` - One-time credit purchases
   - `invoice.paid` - Subscription renewals
   - `customer.subscription.updated` - Status changes
   - `customer.subscription.deleted` - Cancellations

5. Click **"Add endpoint"**

6. **Copy the Signing Secret** (starts with `whsec_...`)

---

## 3. Add Environment Variable

Add the webhook secret to your environment:

### Local Development (.env)
```
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### Vercel
1. Go to Project Settings → Environment Variables
2. Add:
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_your_secret_here`
3. Redeploy

---

## 4. Test Webhooks Locally

Use Stripe CLI to forward webhooks to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8787/api/webhooks/stripe

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

---

## 5. Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Calls `fulfill_checkout()` RPC for one-time purchases |
| `invoice.paid` | Adds monthly credits based on subscription plan |
| `customer.subscription.updated` | Syncs subscription status |
| `customer.subscription.deleted` | Marks subscription as canceled |

---

## 6. Verification Checklist

- [ ] SQL function `add_monthly_credits` deployed
- [ ] Webhook endpoint registered in Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` set in Vercel
- [ ] Test with Stripe CLI locally
- [ ] Make a test purchase and verify credits are added

---

## Troubleshooting

### "Invalid signature" errors
- Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
- The secret is different for each webhook endpoint

### Credits not added after subscription renewal
- Check Vercel logs for the `invoice.paid` event
- Verify `organization_subscriptions.stripe_subscription_id` is set

### Webhook not receiving events
- Check the webhook endpoint URL is correct
- Ensure the endpoint is publicly accessible (not localhost)
