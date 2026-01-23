# Stripe Subscription Setup for WriterVerse Hub

This document explains how to configure Stripe so the 7‑day trial + subscription flow works with the `subscription_plans` and `organization_subscriptions` tables.

---

## 1. Prerequisites

- A Stripe account (test mode is fine for development).
- Access to the Stripe Dashboard.
- Access to your deployment environment variables (local `.env`, Vercel project settings).
- The SQL migrations for pricing are already applied:
  - `SQL46_pricing-table.sql` (creates `subscription_plans` and `organization_subscriptions`).
  - The relevant section in `sql/till.sql` (same schema, idempotent).

The backend Express endpoints you are wiring up:

- `POST /api/billing/subscription/session`  (creates Stripe Checkout session for a subscription + 7‑day trial)
- `POST /api/billing/subscription/confirm`  (confirms the session, updates `organization_subscriptions`, grants trial credits)

The frontend entry points:

- Pricing page: `src/pages/Pricing.tsx`
- Dashboard handling of `sub_session_id`: `src/pages/Dashboard.tsx`

---

## 2. Environment variables

Configure the following env vars in **all environments that use subscriptions**:

### 2.1. Local development (`.env`)

Add these to your `.env` (or `.env.local`) at the repo root:

- `STRIPE_SECRET_KEY=sk_test_...`
- `SUPABASE_URL=...` (or `VITE_SUPABASE_URL` if that is what you use today)
- `SUPABASE_SERVICE_ROLE_KEY=...` (or `SUPABASE_SERVICE_ROLE`)

Restart the dev server and Express server after changing these.

### 2.2. Vercel project settings

In the Vercel dashboard, go to **Project → Settings → Environment Variables** and add the same keys:

- `STRIPE_SECRET_KEY` (test mode key to start)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after saving.

> Note: We currently only use the **secret key** on the backend. The publishable key is not required for this server‑side Checkout flow because we are redirecting directly to Stripe’s hosted page.

---

## 3. Create Products and Prices in Stripe

We assume three subscription plans that map to `subscription_plans.code`:

- `pro`
- `business`
- `agency`

### 3.1. Create Products

In Stripe Dashboard:

1. Go to **Products → + Add product**.
2. Create a product for each code:

   - **Pro**
     - Name: `Pro`
     - Description: `For small teams getting started with WriterVerse Hub`

   - **Business**
     - Name: `Business`
     - Description: `For growing teams that need analytics and integrations`

   - **Agency**
     - Name: `Agency`
     - Description: `For larger organizations and agencies with higher volume needs`

3. You can leave Images empty; they are not required for backend integration.

### 3.2. Create recurring Prices with 7‑day trial

For each product above, you must create **two prices**:

- A **monthly** recurring price.
- A **yearly** recurring price.

Steps (repeat per product):

1. Open the product in Stripe.
2. Under **Pricing**, click **+ Add price**.
3. Configure **Monthly** price:
   - Pricing model: **Standard pricing**.
   - Price: use the same amount you used in `subscription_plans.monthly_price_cents`:
     - Pro: `$49.00` / month
     - Business: `$149.00` / month
     - Agency: `$299.00` / month
   - Billing period: **Monthly**.
   - Trial period: **7 days** (this is important for the free trial experience).
   - Save.
4. Configure **Yearly** price:
   - Pricing model: **Standard pricing**.
   - Price: yearly amount (should roughly match `yearly_price_cents` / 100):
     - Pro: `$420.00` / year (effective $35/mo)
     - Business: `$1,440.00` / year
     - Agency: `$2,880.00` / year
   - Billing period: **Yearly**.
   - Trial period: **7 days**.
   - Save.

After saving, you should have **six price IDs** (two per product).

Example IDs (your actual values will differ):

- `price_pro_monthly`  → `price_1ProMonthly_123`
- `price_pro_yearly`   → `price_1ProYearly_456`
- `price_business_monthly` → `price_1BizMonthly_789`
- etc.

Copy each **Price ID**; we will set them into Postgres next.

---

## 4. Map Stripe Prices into `subscription_plans`

The SQL schema (from `SQL46_pricing-table.sql` / `till.sql`) already created this table:

```sql
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL,
  yearly_price_cents integer,
  included_credits_per_month integer NOT NULL,
  seat_limit integer NOT NULL,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

After running `SQL46` and `till.sql` up to the subscription section, you should already have seed rows for `pro`, `business`, and `agency`.

Now you must **update the `stripe_*_price_id` fields** with the IDs you created in Stripe.

### 4.1. Example update script

Run this in Supabase SQL editor or `psql` (replace with your real price IDs):

```sql
UPDATE public.subscription_plans
SET stripe_monthly_price_id = 'price_1ProMonthly_123',
    stripe_yearly_price_id  = 'price_1ProYearly_456'
WHERE code = 'pro';

UPDATE public.subscription_plans
SET stripe_monthly_price_id = 'price_1BizMonthly_789',
    stripe_yearly_price_id  = 'price_1BizYearly_ABC'
WHERE code = 'business';

UPDATE public.subscription_plans
SET stripe_monthly_price_id = 'price_1AgencyMonthly_DEF',
    stripe_yearly_price_id  = 'price_1AgencyYearly_GHI'
WHERE code = 'agency';
```

You can re-run these updates any time you need to rotate prices.

---

## 5. How the backend uses these values

The Express backend (`server/index.js`) has the subscription session endpoint:

- `POST /api/billing/subscription/session`

It does the following:

1. Resolves the **organization** from `X-User-Id` and optionally `x-organization-id`.
2. Loads the `subscription_plans` row for the given `planCode` (e.g. `pro`).
3. Chooses `stripe_monthly_price_id` or `stripe_yearly_price_id` based on `billingInterval`.
4. Creates a Stripe Checkout Session for a **subscription** with a **7‑day trial** (configured on the Price in Stripe).
5. Upserts an `organization_subscriptions` row to track the org’s subscription state.
6. Returns `{ url }` to the frontend.

The confirm endpoint:

- `POST /api/billing/subscription/confirm`

This is called after Stripe redirects back with `?sub_session_id=...` and:

1. Fetches the Checkout Session and underlying Subscription from Stripe.
2. Updates `organization_subscriptions` with:
   - `stripe_subscription_id`
   - `status` (e.g. `trialing`, then later `active`)
   - `trial_start` / `trial_end`
   - `current_period_start` / `current_period_end`
3. Grants **trial credits** to the organization once, if `trial_credits_granted = false`.
4. Returns a payload that Dashboard uses to show a friendly success message.

> Note: Webhooks for lifecycle events and metered overages are **not** implemented as part of this task; they can be added later.

---

## 6. How the frontend uses subscriptions

### 6.1. Pricing page (`src/pages/Pricing.tsx`)

- Renders the Pro and Business plans.
- Calls `createSubscriptionSession(planCode, billingInterval)` when the user clicks **Start 7‑day trial**.
- That function calls `POST /api/billing/subscription/session` and then redirects the browser to the returned Stripe Checkout URL.

### 6.2. Dashboard (`src/pages/Dashboard.tsx`)

- On mount, it checks the current URL for `session_id` (one‑off credits checkout) or `sub_session_id` (subscription trial).
- If `sub_session_id` is present:
  - Calls `confirmSubscription(subSessionId)` → `POST /api/billing/subscription/confirm`.
  - Shows a message summarizing the plan code, trial credits granted, and trial end date.
  - Reloads profile data.

For everything to work, **both** of these must be true:

1. Stripe prices exist with a 7‑day trial.
2. `subscription_plans` has the correct `stripe_monthly_price_id` and `stripe_yearly_price_id` values for each plan code.

---

## 7. Verification checklist

After configuration, you should verify:

- [ ] `/api/billing/subscription/session` returns a valid `url` when called with:
  - `planCode = 'pro'`, `billingInterval = 'monthly'`.
- [ ] Visiting the URL opens Stripe Checkout with the **correct product name and price** and shows a **7‑day trial**.
- [ ] Completing Checkout redirects back to your app with `?sub_session_id=...`.
- [ ] Dashboard successfully calls `/api/billing/subscription/confirm` and shows a success banner.
- [ ] `organization_subscriptions` row is created/updated with `status = 'trialing'` and correct `trial_end`.
- [ ] `organization_credits.balance_credits` increased by the configured trial amount (e.g. 7,500 credits).

If any of these fail, check:

- Browser console (network tab) for `/api/billing/subscription/*` errors.
- Server logs for Stripe configuration issues (`STRIPE_SECRET_KEY` not set, missing price IDs, etc.).
- Database rows for `subscription_plans` and `organization_subscriptions`.
