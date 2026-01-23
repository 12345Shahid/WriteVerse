# Subscription Trial Flow - Restoration Guide

This document explains the trial activation system in WriteVerse Hub and provides step-by-step instructions for restoring the **credit-card-required trial flow** if it has been disabled.

---

## Current Behavior (Auto-Trial, No Card)

After a user signs up:
1. A 7-day trial is **automatically activated** with the `professional` plan.
2. User receives **7,000 credits**.
3. User is redirected directly to `/dashboard`.
4. **No credit card is required.**

---

## Original Behavior (Card Required via Stripe)

Previously:
1. User signs up and is redirected to `/subscription/pricing`.
2. User must select a plan and click "Start Free Trial".
3. The app calls `/api/subscriptions/checkout-trial` which creates a Stripe Checkout session.
4. User enters credit card info on Stripe.
5. Stripe creates a subscription with `trial_period_days: 7`.
6. User is redirected to `/dashboard` after successful checkout.

---

## Files Involved

| File | Purpose |
| :--- | :--- |
| `src/pages/Auth.tsx` | Handles signup and post-signup redirect. |
| `src/pages/subscription/PricingPage.tsx` | Plan selection UI with "Start Free Trial" buttons. |
| `src/hooks/useSubscription.tsx` | Contains `startTrial()` (no card) and `startTrialWithCard()` (Stripe). |
| `api/subscriptions/start-trial.ts` | Backend: Creates trial without Stripe. |
| `api/subscriptions/checkout-trial.ts` | Backend: Creates Stripe Checkout session for card-required trial. |

---

## How to Restore Card-Required Trial

### Step 1: Modify `Auth.tsx`

**Location**: `src/pages/Auth.tsx`

Find the default redirect URL (around line 19):
```tsx
const returnTo = redirect || "/dashboard"; // Changed: Auto-trial means we go to dashboard directly
```

Change it back to:
```tsx
const returnTo = redirect || "/subscription/pricing";
```

Then, **remove the auto-trial API call blocks**. In the `handleSignup` function, find and remove these sections:

```tsx
// Auto-activate trial for new signups (no credit card required)
const teamId = (await listTeams())?.[0]?.id;
if (teamId) {
  try {
    // ... the entire fetch call to /api/subscriptions/start-trial ...
  } catch (trialErr) {
    console.warn("[Auth] Trial activation error:", trialErr);
  }
}
```

There are **two such blocks** in the file:
1. Inside the `if (data?.session)` block (when session is immediately available).
2. Inside the auto-login `.then()` callback (when email confirmation is skipped).

After removing, the code should simply navigate to `returnTo` without calling the trial API.

---

### Step 2: Verify `PricingPage.tsx`

**Location**: `src/pages/subscription/PricingPage.tsx`

The page already uses `startTrialWithCard()` from the `useSubscription` hook. Just ensure:
1. The "Start Free Trial" button calls `handleStartTrial(plan)`.
2. `handleStartTrial` calls `startTrialWithCard(plan, isAnnual ? 'yearly' : 'monthly')`.
3. Upon success, the user is redirected to Stripe Checkout.

No changes should be needed here if it wasn't modified.

---

### Step 3: Verify Stripe Configuration

Ensure the following environment variables are set on Vercel:

| Variable | Description |
| :--- | :--- |
| `STRIPE_SECRET_KEY` | Your Stripe secret key (starts with `sk_`) |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | Price ID for Starter monthly plan |
| `STRIPE_STARTER_YEARLY_PRICE_ID` | Price ID for Starter yearly plan |
| `STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID` | Price ID for Professional monthly plan |
| `STRIPE_PROFESSIONAL_YEARLY_PRICE_ID` | Price ID for Professional yearly plan |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Price ID for Business monthly plan |
| `STRIPE_BUSINESS_YEARLY_PRICE_ID` | Price ID for Business yearly plan |

In your **Stripe Dashboard**, ensure:
- Products and Prices are created for each plan.
- Each Price has `trial_period_days` set to `7` if you want Stripe to manage the trial.

---

### Step 4: Deploy and Test

1. Run `npm run build` to verify no errors.
2. Deploy to Vercel: `npx vercel --prod --yes`.
3. Test the flow:
   - Sign up as a new user.
   - Verify redirect to `/subscription/pricing`.
   - Click "Start Free Trial" on a plan.
   - Verify redirect to Stripe Checkout.
   - Complete checkout with a test card (`4242 4242 4242 4242`).
   - Verify redirect to `/dashboard` and subscription is active.

---

## Quick Reference: API Endpoints

| Endpoint | Method | Card Required? | Description |
| :--- | :--- | :--- | :--- |
| `/api/subscriptions/start-trial` | POST | No | Creates a trial record directly in the database. |
| `/api/subscriptions/checkout-trial` | POST | Yes | Creates a Stripe Checkout session with trial. |

---

## Summary

To switch between flows:
- **Auto-trial (no card)**: Call `/api/subscriptions/start-trial` in `Auth.tsx` after signup.
- **Card-required trial**: Redirect to `/subscription/pricing` and let user trigger Stripe Checkout.
