# WriterAI Hub – Developer Overview

This file is meant for **future developers** who may want to rebuild or adapt the project, possibly with a different backend, database, or deployment platform.

---

## 1. High-Level Concept

- **Product**: Unified AI writing tools platform ("WriterAI Hub").
- **Primary tool**: Email Subject Line Generator.
- **Additional tools** (same UI + backend patterns):
  - Resume bullet generator
  - Cold email personalizer
  - Product description writer
  - Job description generator
  - LinkedIn post generator
  - (Plus some extra tools like summarizer, cover letter, social ads, Twitter/X threads, FAQ, script generator.)

Common backend pattern: **single generate endpoint** that accepts a `tool` name and tool-specific `inputs`, then routes to the right prompt template and output formatter.

---

## 2. Frontend Stack & Structure

- **Framework**: React + Vite (TypeScript).
- **Routing**: `react-router-dom` for pages/routes.
- **UI library**: shadcn/ui components on top of **Tailwind CSS**.
- **State/data**:
  - React Query (`@tanstack/react-query`) for API calls and caching.
  - React local state / hooks for UI.
- **Forms**:
  - `react-hook-form` for form handling.
  - `zod` for validation schemas on the frontend.

### Important frontend files

- `src/pages/tools/EmailSubjectTool.tsx`
  - Main UI for the Email Subject Line Generator.
  - Calls `generate()` from `src/lib/api.ts`.
- `src/lib/api.ts`
  - `generate()` – posts to `/api/generate` with `{ tool, inputs, outputCount, tone }`.
  - `saveResults()` – posts to `/api/results/save`.
- `tailwind.config.ts`
  - Tailwind theme, including typography and animation plugins.
- `components/` and `src/components/` (depending on layout)
  - Reusable UI like forms, cards, sidebar, copy/export buttons.

### Styling notes

- **Tailwind CSS** is the main styling system.
- **shadcn/ui** components are styled via Tailwind (buttons, dialogs, inputs, etc.).
- There is a consistent layout pattern:
  - Sidebar for selecting tools.
  - Main content area: form at the top, results as cards below.
- If you rebuild from scratch:
  - You can reuse Tailwind utility classes and the same component structure.
  - Or replace Tailwind+shadcn with any modern component library (Mantine, MUI, Chakra, etc.), as long as forms call the same APIs.

---

## 3. Backend Responsibilities

There are **two** backend styles in this repo:

1. **Vercel-style API routes** (current production target)
   - Located in `api/` (e.g., `api/generate.ts`, `api/results/save.ts`, etc.).
   - Export a default handler `(req, res)` using Node-style request/response.
2. **Express server** (local dev / alternative deployment)
   - Located in `server/index.js`.
   - Implements similar endpoints: `/api/generate`, `/api/results/save`, `/api/ab-tests`, `/api/public/:slug`, etc.

For a complete rebuild, you only need **one** backend style. You can:
- Keep using Node/Express (easiest if deploying to a generic VM or container).
- Or use serverless functions (AWS Lambda, Cloudflare Workers, etc.), re-implementing the same REST endpoints.

### Core backend endpoint

- `POST /api/generate`
  - Body (simplified):
    - `tool`: one of `email_subject`, `resume`, `cold_email`, `product_description`, `job_description`, `linkedin`, `social_ad`, `summarizer`, `cover_letter`, `twitter_thread`, `faq`, `script`.
    - `inputs`: tool-specific payload (object).
    - `outputCount` (optional): number of outputs to generate.
    - `tone` (optional): tone override.
  - Returns:
    - `results`: tool-specific normalized output.
    - `debug`: metadata (tool, duration, model name, credits used, etc.).

The backend:
- Validates the request with `zod` (`ToolSchema`).
- Applies a **content safety filter** (no alcohol, weapons, illegal drugs, explicit adult content).
- Optionally enforces **credits** (per-user `credits_balance` in the database).
- Calls an AI model (currently **Gemini**, via `@google/generative-ai`).
- Attempts to parse AI output as JSON and normalize into `results`.
- Logs usage to a `tool_usage` table.
- Falls back to **safe / placeholder outputs** if the AI call fails.

You are free to **swap out the AI provider**:
- Current code is written for **Google Gemini** (e.g., `gemini-2.0-flash`).
- You can replace it with OpenAI, Anthropic, or any other model as long as:
  - The prompt builder returns a string input for the model.
  - The model returns JSON (or something you can parse into the expected `results` shapes).

---

## 4. Database & Authentication

The current implementation assumes:

- **Database**: PostgreSQL via **Supabase**.
- **Auth**: Supabase Auth (JWT-based).

Key points:

- Schema is defined in the SQL files in the `sql/` folder (see `sql/till.sql`).
- Important tables:
  - `users` – profile and usage info (subscription tier, credits, etc.).
  - `tool_usage` – logs which tool a user used and when.
  - `saved_results` – stores generated outputs so they can be re-opened later.
  - `ab_tests` – optional A/B test metadata for email subject lines.
  - `credits_transactions` – bookkeeping for credit purchases.
- Row-level security (RLS) policies are set up so that users can only see their own rows.
- There is a **service-role** Supabase client in the backend used only on the server (never in the browser).

> **Important for future developers**: You do **not** have to use Supabase.
>
> You can replace this with **any backend + database + auth stack** (e.g., custom Node + PostgreSQL, Firebase, Hasura, Django, etc.).
> Just make sure you:
> - Expose the same REST endpoints (`/api/generate`, `/api/results/save`, `/api/results`, `/api/public/:slug`, etc.).
> - Implement the same semantics: results are saved per user, credits enforced per user, etc.

The Supabase-specific helper for API routes is in `api/_lib/supabase.ts`.

---

## 5. Credits & Safety Logic

- Credits are optional but implemented in the current backend.
- Each tool has a small **credit cost**, configured in a map (`TOOL_CREDIT_COST`).
- When a user calls `/api/generate` with a `X-User-Id` header:
  - Backend looks up their `credits_balance`.
  - Ensures they have enough credits (if not, returns `402 INSFFICIENT_CREDITS`).
  - Deducts credits on success.
  - Logs usage to `tool_usage`.

Safety filter:
- Inspects all string inputs for blocked words (alcohol, weapons, illegal drugs, explicit adult terms).
- If unsafe, backend returns safe “policy” messages instead of hitting the AI model.

You can keep, extend, or remove this logic depending on product requirements.

---

## 6. Deployment Notes (for other platforms)

The repo currently includes a `vercel.json` and Vercel-compatible API routes in `api/`, but **you are not forced to use Vercel**.

If you deploy elsewhere, you can:

- Use **Node/Express** (`server/index.js`) as your canonical backend, then:
  - Run it in a container (Docker), a VM, or any Node hosting.
  - Serve the static frontend build (`dist/`) from a CDN or any static hosting.
- Or rewrite the `api/` folder as serverless functions for your target platform (e.g., AWS Lambda/API Gateway, Cloudflare Workers, Netlify Functions, etc.).

Key things to keep consistent:
- Endpoints: URL paths and JSON contracts (`/api/generate`, `/api/results/save`, `/api/results`, `/api/public/:slug`, `/api/ab-tests`, etc.).
- Use of header `X-User-Id` (or any auth mechanism) to identify the user in backend logic.
- Environment variables for AI provider + database credentials.

You *do not* need to configure Vercel-specific settings for a fresh build on another platform.

---

## 7. How to Rebuild From Scratch (Minimal Steps)

1. **Frontend**
   - Scaffold a React + TypeScript + Tailwind project (or any modern stack).
   - Implement a dashboard page with:
     - Tool selection sidebar.
     - Main content: chosen tool’s form + results.
   - For each tool, create a form that calls `POST /api/generate` with appropriate `tool` and `inputs`.

2. **Backend**
   - Implement `POST /api/generate` in your preferred environment.
   - Reuse the prompt patterns from the existing codebase (see `api/generate.ts` and `server/index.js`).
   - Implement **credits** and **saved_results** only if you want account-level features.

3. **Database & Auth**
   - Either:
     - Use Supabase and copy the schema from `sql/till.sql`, or
     - Recreate similar tables in your own database.
   - Implement authentication (email/password, OAuth, etc.) that can yield a user ID for the backend to trust.

4. **Deployment**
   - Build frontend (e.g., `npm run build`) and deploy `dist/` to static hosting.
   - Deploy backend to your preferred platform.

---

## 8. Summary

- WriterAI Hub is a **multi-tool AI writing dashboard** with:
  - Shared UI patterns (forms + result cards).
  - A single `/api/generate` endpoint.
  - Optional credits and usage tracking.
  - Safety filtering.
- Current implementation uses:
  - React + Vite + Tailwind + shadcn/ui on the frontend.
  - Supabase (Postgres + Auth) for data and identity.
  - Gemini (via `@google/generative-ai`) as the AI model.
  - Vercel-style API routes and/or an Express server.
- Future developers are free to:
  - Swap out the AI provider.
  - Replace Supabase with any other DB/auth solution.
  - Deploy on any platform (containers, serverless, traditional servers) as long as the REST API contracts remain the same.
