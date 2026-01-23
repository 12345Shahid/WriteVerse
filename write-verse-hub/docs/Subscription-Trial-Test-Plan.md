# Subscription & Trial Test Plan

This document lists manual tests and terminal commands to verify the 7‑day trial + subscription flow and basic seat‑limit behavior.

---

## 1. Prerequisites

- Local environment:
  - `npm install`
  - Supabase env vars set in `.env`:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
  - Stripe env var set:
    - `STRIPE_SECRET_KEY`
- Database migrations applied, including:
  - `SQL46_pricing-table.sql`
  - The subscription section in `sql/till.sql`.
  - `organization_credits` and `fulfill_checkout`/`record_usage` functions from previous batches.
- Dev servers running:
  - `npm run dev` (Vite frontend on port 8080).
  - `npm run server:dev` (Express backend on port 8787).

> For production/Vercel, the same endpoints are exposed via `/api/...` without the localhost port.

---

## 2. Basic subscription session creation

### 2.1. Start a Pro monthly trial (via curl)

Replace `USER_ID` with an authenticated Supabase user ID, and `ORG_ID` with the active organization.

```bash
curl -X POST "http://localhost:8787/api/billing/subscription/session" \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -H "x-organization-id: ORG_ID" \
  -d '{
    "planCode": "pro",
    "billingInterval": "monthly"
  }'
```

**Expected:**

- Response: `{ "url": "https://checkout.stripe.com/c/pay/cs_test_..." }`.
- No `PLAN_NOT_FOUND` or `PRICE_NOT_CONFIGURED` errors.

If you see `PRICE_NOT_CONFIGURED`, check that `subscription_plans.stripe_monthly_price_id` is set for `code = 'pro'`.

### 2.2. Start a Business yearly trial

```bash
curl -X POST "http://localhost:8787/api/billing/subscription/session" \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -H "x-organization-id: ORG_ID" \
  -d '{
    "planCode": "business",
    "billingInterval": "yearly"
  }'
```

Expected behavior is the same, but using the yearly price.

---

## 3. Confirming a subscription session

In real usage, Stripe redirects back to your app with `?sub_session_id=...` and the Dashboard page calls the confirm endpoint.

For manual testing, you can call it directly from the terminal.

### 3.1. Confirm from terminal

After completing a Checkout session in test mode, grab the **Checkout Session ID** from Stripe’s dashboard (e.g. `cs_test_123...`). Then run:

```bash
curl -X POST "http://localhost:8787/api/billing/subscription/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -H "x-organization-id: ORG_ID" \
  -d '{
    "sessionId": "cs_test_123..."
  }'
```

**Expected:**

- Response includes:
  - `ok: true`
  - `status: "trialing"` (initially)
  - `plan_code: "pro" | "business" | "agency"`
  - `trial_credits_added: 7500` (or your configured amount)
  - `trial_end: <ISO timestamp>`
- The same organization’s row in `organization_subscriptions` is updated with:
  - `stripe_subscription_id`
  - `status = 'trialing'`
  - `trial_start` / `trial_end`

Check via SQL:

```sql
SELECT *
FROM public.organization_subscriptions
WHERE organization_id = 'ORG_ID';
```

And verify credits:

```sql
SELECT *
FROM public.organization_credits
WHERE organization_id = 'ORG_ID';
```

You should see `balance_credits` increased by the trial amount the **first** time trial is confirmed (the backend uses `trial_credits_granted` to avoid double‑granting).

---

## 4. End‑to‑end UI test (Pricing → Stripe → Dashboard)

1. Start local servers:

   ```bash
   npm run dev
   npm run server:dev
   ```

2. Open the app at `http://localhost:8080` and sign in.
3. Ensure you have an active workspace/team selected.
4. Navigate to **Pricing** (`/pricing`).
5. Click **Start 7‑day trial (Monthly)** for Pro.
   - The frontend calls `createSubscriptionSession('pro', 'monthly')` → `/api/billing/subscription/session`.
   - You should be redirected to Stripe Checkout.
6. Complete the payment using Stripe test card (e.g. `4242 4242 4242 4242`).
7. Stripe redirects back to your app with `?sub_session_id=...`.
8. The Dashboard (`/`) should:
   - Call `/api/billing/subscription/confirm`.
   - Show a success banner summarizing the trial.
   - Refresh profile data.

If anything fails, check:

- Devtools **Network** tab for `/api/billing/subscription/*` errors.
- Server console logs (Express) for Stripe or Supabase errors.

---

## 5. Seat‑limit enforcement basic checks

Seat limits per plan (from `subscription_plans`):

- Pro: `seat_limit = 5`
- Business: `seat_limit = 15`
- Agency: `seat_limit = 30`

The Express backend enforces seat caps in the team invite/join endpoints:

- `POST /api/teams/:id/invite`
- `POST /api/teams/join`

### 5.1. Invite members up to the limit

Assume `TEAM_ID` is an organization/team id.

```bash
curl -X POST "http://localhost:8787/api/teams/TEAM_ID/invite" \
  -H "Content-Type: application/json" \
  -H "x-user-id: OWNER_USER_ID" \
  -d '{
    "email": "user+1@example.com",
    "role": "editor"
  }'
```

Repeat invites until you reach the plan’s `seat_limit` (including the owner). All should succeed.

### 5.2. Invite beyond the limit

Send one more invite beyond `seat_limit`.

**Expected:**

- The API responds with an error indicating seat limit exceeded and asks to upgrade.
- The message text follows what was implemented in `server/index.js` in the team invite section.

You can also check the `organization_members` table:

```sql
SELECT *
FROM public.organization_members
WHERE organization_id = 'ORG_ID';
```

You should never see the count exceed the configured `seat_limit`.

---

## 6. Regression checks for generate endpoint

The generate endpoint (`/api/generate`) uses **organization credits** (`organization_credits.balance_credits`) and the `record_usage` RPC.

After activating a trial and receiving trial credits:

1. Call `POST /api/generate` with a small, cheap tool (e.g. `email_subject`).
2. Verify that it succeeds and the response includes generated content.
3. Check `organization_credits.balance_credits` has decreased by the expected `creditsCharged` amount.

This confirms that:

- Trial credits are usable for generation.
- Credit deduction still works after the subscription changes.

---

## 7. Notes

- Webhooks for subscription lifecycle (trial ending, cancellations) and metered overage reporting are **intentionally out of scope** for this test plan.
- If you encounter unexpected 500s from `/api/billing/subscription/*`, start by checking env vars and the `subscription_plans` rows before debugging deeper logic.
