# WriterAI

AI writing workspace that bundles multiple tools in a fast, brutalist UI. Create, save, share, and A/B test content with a Gemini-powered backend and Supabase persistence.

## Features

- Email Subject Line Generator with A/B testing
- Resume Bullet Generator
- Cold Email Personalizer
- Product Description Writer
- Job Description Generator (PDF export)
- LinkedIn Post Generator
- Social Media Ad Copy
- Paragraph Summarizer
- Cover Letter Generator
- Twitter/X Thread Composer
- FAQ Generator (optional JSON-LD)
- Script/Voiceover Writer (timed segments)
- Saved results, public sharing links, export (CSV/TXT/PDF)

## Tech stack

- Frontend: React 18, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui, TanStack Query
- Backend: Node.js (Express)
- AI Model: Google Gemini 2.0 Flash
- Data/Auth: Supabase (Postgres, Auth, RLS)
- Other: express-rate-limit, Stripe (stubs), lucide-react

## Requirements

- Node.js 18+ and npm
- Supabase project (URL + Service Role key)
- Gemini API key

## Environment variables

Create `.env.local` (backend env) based on `.env.example` and set the following:

```
PORT=8787
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.0-flash
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Never commit real secrets. The example file only documents variable names.

## Getting started

```bash
npm install
npm run dev:all   # starts Vite (http://localhost:8080) and API (http://localhost:8787)
```

## Scripts

- `npm run dev` — frontend (Vite)
- `npm run server:dev` — backend (nodemon)
- `npm run dev:all` — run both (concurrently)
- `npm run build` — build frontend
- `npm run preview` — preview built site

## API endpoints (selected)

- `POST /api/generate` — generate with `{ tool, inputs, outputCount?, tone? }`
- `POST /api/results/save` — save a generation
- `GET /api/results` — list user’s saved results
- `POST /api/results/:id/share` / `POST /api/results/:id/unshare` — toggle public link
- `GET /api/public/:slug` — fetch a public shared item
- `POST /api/ab-tests` / `POST /api/ab-tests/:id/winner` — A/B tests

## Database & migrations

- Supabase Postgres with RLS
- SQL migrations live in `sql/` (e.g., `SQL1.sql`…`SQL6.sql`)
- `SQL6.sql` fixes policy syntax and adds A/B tests + sharing columns

## Project structure (simplified)

```
server/            # Express API
src/
  components/
  pages/
    tools/
  lib/
sql/               # database migrations
```

## Development notes

- Public sharing renders at `/public/:slug` (frontend page).
- Pricing is marked “Coming soon”.
- Credits/tokens are not shown in nav per product brief.

## Security

- Do not commit secrets. Use `.env.local` for local dev.
- Rate limiting is enabled on generation to prevent abuse.

## License

Private/internal. All rights reserved.
