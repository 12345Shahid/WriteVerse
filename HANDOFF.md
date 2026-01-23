# Write AI – Project Handoff

This document summarizes the work completed to date, how the system is structured, how to run and deploy it, and recommended next steps. It is intended for the next maintainer to pick up quickly.

## What was changed in this phase

- Auth UI refactor
  - Removed Google and GitHub social login buttons from `src/pages/Auth.tsx` (email/password only).
  - Added a Sign Out control in the top navigation (`src/components/SiteNav.tsx`) that calls `supabase.auth.signOut()` and redirects to `/auth`.
- Serverless backend on Vercel
  - Migrated critical API routes from the local Express server to Vercel serverless functions under `/api/*`.
  - Created endpoints:
    - `api/profile.ts` – returns user profile limits/credits from Supabase.
    - `api/generate.ts` – content generation, credits checks, persists results.
    - `api/results/index.ts` – list saved results (GET).
    - `api/results/save.ts` – save a result (POST).
    - `api/results/[id].ts` – delete a result (DELETE).
    - `api/results/[id]/share.ts` – share a result (POST).
    - `api/results/[id]/unshare.ts` – unshare a result (POST).
    - `api/public/[slug].ts` – fetch a public shared result by slug (GET).
    - `api/ab-tests/index.ts` – list/create A/B tests (GET/POST).
    - `api/ab-tests/[id]/winner.ts` – set the winner for an A/B test (POST).
    - `api/checkout/session.ts` – create a Stripe checkout session and log a pending transaction.
- Pricing page
  - Created a dedicated static page `src/pages/Pricing.tsx` using the same content that was on the homepage Pricing section.
  - Updated header and footer Pricing links to route to `/pricing`.
- Routing updates
  - Registered the route in `src/App.tsx`: `/pricing` → `Pricing` page.
- Production deploys
  - Deployed to Vercel production after each milestone.

## Project structure (selected)

- `src/pages/Auth.tsx` – Email/password login and signup forms.
- `src/components/SiteNav.tsx` – Top navigation, auth state tracking, Sign Out.
- `src/pages/Pricing.tsx` – Dedicated static pricing page.
- `src/pages/Index.tsx` – Homepage (now links to `/pricing`).
- `src/App.tsx` – App routing definitions.
- `src/lib/supabase.ts` – Supabase client; `getUserId()` helper.
- `api/*` – Vercel serverless APIs (see above list).
- `server/index.js` – Original Express server (left in repo for reference; production uses Vercel functions).
- `vite.config.ts` – Dev proxy for `/api` to local backend if used.

## Environment variables

Frontend (Vite):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Serverless (Vercel functions):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (if generation uses Gemini)
- `STRIPE_SECRET_KEY` (for checkout session)

Set these in Vercel Project Settings → Environment Variables. Do not commit secrets.

## Auth model

- Supabase email/password authentication via `supabase.auth.signInWithPassword` and `supabase.auth.signUp` in `Auth.tsx`.
- Session is observed via `supabase.auth.getUser()` and `supabase.auth.onAuthStateChange` in both `SiteNav` and some pages.
- API routes expect `X-User-Id` header on requests that require auth. The frontend helpers in `src/lib/api.ts` fetch the current user ID via Supabase and inject this header.
- Sign Out is implemented in `SiteNav` → `handleSignOut()`.

## Serverless API notes

- Code is TypeScript but many functions include `// @ts-nocheck` to suppress transient IDE TS errors in the serverless folder. This doesn’t affect runtime.
- The profile endpoint (`api/profile.ts`) queries Supabase `users` table for limits and credits. It reads the user ID from the `X-User-Id` header.
- Generation endpoint performs credit checks and writes usage records. Review `sql/till.sql` for table structures and policies. Do not modify the SQL file directly; it’s documentation of the schema.

## Running locally

1. Install deps
   - `pnpm i` or `npm i` or `yarn` (use the project’s preferred manager).
2. Configure environment
   - Create `.env` for Vite variables and ensure serverless env vars exist when testing functions.
3. Start dev server
   - `pnpm dev` (or `npm run dev`/`yarn dev`).
   - Vite runs the frontend. If you still use the Express server, it listens on `:8787`; Vite proxies `/api` there (see `vite.config.ts`).
4. Testing serverless locally
   - You can use `vercel dev` to emulate Vercel functions locally, or call deployed endpoints directly.

## Deployment

- Deploy to Vercel production:
  - `npx vercel --prod --yes`
- Production URL (latest):
  - Example: https://write-g68u60n6i-shahids-projects-1423cd8d.vercel.app
  - Check your Vercel dashboard for the current canonical URL or configure a custom domain.

## Frontend routes (selected)

- `/` – Homepage
- `/auth` – Login/Signup
- `/dashboard` – User dashboard (calls `/api/profile`)
- `/results` – Saved results
- `/public/:slug` – Public shared result page
- `/pricing` – Pricing page
- `/tools/*` – All AI tools

## Common issues and tips

- If direct navigation to routes like `/pricing` shows a 404, add a Vercel SPA rewrite to route all non-file requests to `index.html`.
- Ensure Supabase keys are set for both frontend and serverless.
- If `@supabase/supabase-js` types trigger IDE errors in serverless, `// @ts-nocheck` is already applied where needed.
- Stripe and Gemini require valid API keys in production.

## Next steps (recommended)

- Stripe integration
  - Wire real plan prices and connect `checkout/session` with a post-payment webhook to upgrade user tiers and credits.
- Pricing/Plans
  - Replace "Coming soon" placeholders with actual prices and features on `Pricing.tsx`.
- Access control
  - Enforce RLS policies and confirm all serverless routes validate `X-User-Id` thoroughly.
- UX/Polish
  - Convert Sign Out into a profile dropdown with user email and quick links.
- Observability
  - Add structured logging and error monitoring (Sentry) across serverless functions.

## Contacts and references

- Supabase docs: https://supabase.com/docs
- Vercel serverless functions: https://vercel.com/docs/functions
- Stripe Checkout Sessions: https://stripe.com/docs/payments/checkout
- Gemini API: Refer to your chosen SDK’s docs; set `GEMINI_API_KEY`.

---
This document should provide enough context to continue development and operations without digging through commits. For anything unclear, search for the corresponding file mentioned above and follow the patterns established in this phase.
