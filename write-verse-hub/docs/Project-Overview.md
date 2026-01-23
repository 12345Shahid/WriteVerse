# WriteVerse Hub – Product & Technical Overview

## 1. Introduction
WriteVerse Hub is a team‑focused AI writing workspace. It combines:

- **Specialised writing tools** for marketing, product, and long‑form content.
- **Custom AI agents** connected to your own knowledge base.
- **Multi‑step workflows** for automating complex content tasks.
- **Shared projects, files, and analytics** for teams.

This document lists all user‑facing features visible in the **top navigation bar** and the **Settings** area, and gives a concise technical overview to help you define pricing and packaging.

---

## 2. Top Navigation Pages
The top navigation (when signed in) contains:

- **All Tools** (dropdown)
- **Dashboard**
- **Projects**
- **Chat**
- **Files**
- **Settings**
- **Saved**

### 2.1 All Tools (Specialised Tools Library)
Accessible from the **All Tools** button in the header. Tools are grouped into categories:

#### Blog & Articles
- **Blog Intros & Outlines** (`/tools/blog-helper`)
  - Generate blog ideas, outlines, and opening paragraphs.

#### Long‑form & SEO
- **Full Blog Post Writer** (`/tools/blog-post`)
- **Article From Outline** (`/tools/article-from-outline`)
- **SEO Blog Optimizer** (`/tools/seo-blog-optimizer`)

Features (shared across these tools):
- Structured prompts (topic, audience, tone, length, keywords, etc.).
- Multi‑section output (titles, outlines, body, meta descriptions).
- Brand Voice support.

#### Copywriting
- **Copywriting Helper** (`/tools/copy-helper`)
  - Short marketing copy for websites, ads, banners, and CTAs.

#### Email & Outreach
- **Email Subject Lines** (`/tools/email-subject`)
- **Cold Emails** (`/tools/cold-email`)
- **Cover Letter** (`/tools/cover-letter`)
- **Email Writer** (`/tools/email-writer`)

#### Career & Hiring
- **Resume Bullets** (`/tools/resume`)
- **Job Descriptions** (`/tools/job-description`)

#### Product & Sales
- **Product Descriptions** (`/tools/product-description`)
- **Social Ad Copy** (`/tools/social-ad`)

#### Social & Content
- **LinkedIn Posts** (`/tools/linkedin`)
- **Twitter / X Thread** (`/tools/twitter-thread`)
- **Script / Voiceover** (`/tools/script`)
- **Social Content Helper** (`/tools/social-helper`)

#### Editing & Rewrite
- **Rewrite & Editing Helper** (`/tools/rewrite-helper`)
  - Rewrite existing text, change tone, shorten / expand, and improve clarity.

#### Case Studies & Reports
- **Case Study Writer** (`/tools/case-study-writer`)
- **Landing Page Writer** (`/tools/landing-page-writer`)
- **Report / Whitepaper Writer** (`/tools/report-writer`)

#### Utilities
- **Summarizer** (`/tools/summarizer`)
- **FAQ Generator** (`/tools/faq`)

All specialised tools share:
- **History saving** to the Saved page.
- **Brand Voice** and **Model** selectors in the header.
- **Credit metering** per generation.

---

### 2.2 Dashboard
Route: `/dashboard`

- Shows current **credit balance** and recent credit purchases.
- Quick actions to purchase more credits (Stripe checkout).
- Entry points to commonly used tools and recent results.

### 2.3 Projects
Route: `/projects`

- List of projects with name, description, and status.
- Each project can hold:
  - Generated documents.
  - Notes and references.
- Designed for grouping work by client, campaign, or product.

### 2.4 Chat
Route: `/chat`

- Team‑oriented chat interface.
- Used for:
  - Discussing AI outputs.
  - Coordinating work across projects.

*(Exact real‑time capabilities depend on your Supabase setup; the UI is built for conversational collaboration.)*

### 2.5 Files
Route: `/files`

- **File Manager** for all uploaded assets.
- Features:
  - Folder hierarchy (nested folders, breadcrumbs, navigation).
  - **Categories** and **Tags** for filtering.
  - Preview metadata (size, type, upload date).
  - Download links (signed URLs via Supabase Storage).
  - Folder‑level tag management.
- **Permissions**:
  - Viewers: can browse and download files.
  - Members/Admins/Owners: can upload, tag, rename, delete.

### 2.6 Settings
Route: `/settings`

- Entry point to all admin and configuration pages (see section **3. Settings Pages**).

### 2.7 Saved
Route: `/results`

- Central **history** of all generated outputs from tools.
- Features:
  - View past generations with inputs and outputs.
  - Save, rename, or delete entries.
  - Generate **public share links** for clients.

---

## 3. Settings Pages (Settings Hub)
The Settings Hub (“Settings” → grid of cards) exposes the following sections:

1. **Team Management** (`/settings/team`)
2. **Analytics** (`/analytics`)
3. **Tags Management** (`/settings/tags`)
4. **Knowledge Base** (`/knowledge`)
5. **Custom Agents** (`/agents`)
6. **Workflows** (`/workflows`)
7. **Templates** (`/templates`)
8. **Brand Voice** (`/brand-voice`)
9. **Embed Chatbot** (`/settings/embed`)

### 3.1 Team Management
- Manage organizations and members.
- Invite or remove users.
- Assign roles:
  - **Owner** – billing, settings, everything.
  - **Admin** – manage members, settings, credits.
  - **Member** – create/edit content and use tools.
  - **Viewer** – read‑only: can view and download, but not change.
- Switch between different teams if you belong to more than one.

### 3.2 Analytics
- Detailed **credit usage analytics** powered by the `usage_events` table.
- Views:
  - **My Analytics** – shows only your own usage.
  - **Organization Overview** – shows team usage (admins/owners only).
- Categories:
  - **Specialised Tools** – cost by tool (e.g., Blog Helper, Email Writer).
  - **Workflows** – credits consumed by workflows.
  - **Custom Agents** – agent chat usage.
  - **Embeds** – usage from embedded chatbots.
- Time filters:
  - Last 7 days, Last 30 days, Last 3 months, All time.
- Storage metrics:
  - Total file storage in MB.
  - Total knowledge base items.

### 3.3 Tags Management
- Global management of **Tags** used across Files and Knowledge Base.
- Create, rename, and delete tags.
- Used for filtering content in other pages.

### 3.4 Knowledge Base
- Upload and manage knowledge documents (PDF, TXT, Markdown, etc.).
- Documents are embedded into vectors for **RAG** (Retrieval‑Augmented Generation).
- Attach KB sources to Custom Agents so they can answer questions based on your content.

### 3.5 Custom Agents
- Create and manage AI agents.
- Configuration options:
  - Agent name and description.
  - System instructions / behaviour.
  - Primary colour and UI settings (for embeds).
  - Connected knowledge base sources.
- Agents can be used:
  - Internally in the app (Chat / Agents pages).
  - Externally via the **Embed Chatbot** widget.

### 3.6 Workflows
- Visual builder for **multi‑step AI workflows**.
- Features:
  - Steps that call specialised tools or agents.
  - Variable mapping between steps (using `{{stepId.field}}`).
  - Loops over lists (e.g., multiple keywords or pages).
  - Conditional logic (branching based on step outputs).
- Used to automate content pipelines such as:
  - Research → Outline → Draft → SEO Optimize.

### 3.7 Templates
- Build **custom tools** for your team.
- Define:
  - Input form schema (fields, labels, defaults).
  - Prompt template (how user input feeds into the AI model).
- Templates behave like built‑in tools and can be shared across the organization.

### 3.8 Brand Voice
- Create and manage **Brand Voice** profiles.
- Features:
  - Analyse existing copy (URL or text) to infer tone and style.
  - Save “Do” and “Don’t” rules, tone tags, and example snippets.
  - Apply Brand Voices to any specialised tool via the header selector.

### 3.9 Embed Chatbot
- Configure and embed Custom Agents on external websites.
- Components:
  - **API Keys** (public keys scoped to an organization).
  - **Agent selector** – choose which agent powers the widget.
  - **Code snippet** – ready‑to‑paste `<script>` tag:
    - `src` points to `/embed/chatbot.js` on the **current origin**.
    - Initialisation with `WriterAIChat.init({ botId, apiKey, collectEmail })`.
- Behaviour:
  - The `chatbot.js` script automatically detects the deployment domain using `document.currentScript.src` and `window.location.origin`.
  - Supports optional email capture before chat.

---

## 4. Technical Architecture

### 4.1 Frontend
- **Framework**: React 18 with Vite.
- **Styling**: TailwindCSS + Shadcn/UI components.
- **Routing**: `react-router-dom`.
- **State / Data Fetching**: React Query (where used) and simple fetch wrappers.
- **Icons**: `lucide-react`.

### 4.2 Backend
- **Runtime**: Node.js (ESM modules).
- **Framework**: Express.
- **Error Monitoring**: Sentry (Node SDK).
- **Rate Limiting**: `express-rate-limit` for `/api/generate`.
- **Static Assets**: `public/` (including `embed/chatbot.js`).

Key endpoints:
- `POST /api/generate` – run specialised tools.
- `POST /api/results/save` – save generated outputs.
- `GET /api/analytics/dashboard` – usage and storage analytics.
- `GET /api/analytics/credits` – credit deductions log.
- `POST /api/checkout/session` / `POST /api/checkout/confirm` – Stripe checkout and credit fulfillment.
- `POST /api/workflows/run` – run workflows (via `workflow-engine`).
- `POST /api/embed/chat` – embedded chatbot gateway.

### 4.3 Data 
- **Supabase Postgres**
  - `users`, `organizations`, `organization_members`.
  - `organization_credits`, `credits_transactions`, `credit_deductions`.
  - `usage_events` – per‑tool usage for analytics.
  - `workflows`, `agents`, `knowledge_base`, `files`, `tags`, etc.
- **Vector Search**: `pgvector` extension used for embeddings in KB.

### 4.4 AI Providers
- **Google Gemini** via `@google/generative-ai`.
- Optional **OpenRouter** client for alternative models.
- Model selection and pricing multipliers stored in `ai_models` table.

### 4.5 Deployment (Vercel‑Ready)
- **Frontend**:
  - `npm run build` produces static assets in `dist/`.
  - Vercel serves the SPA and rewrites all non‑`/api/*` routes to `index.html`.
- **Backend**:
  - `vercel.json` rewrites `/api/*` to `server/index.js`.
  - `server/index.js` **exports the Express app** and only calls `app.listen()` when not running on Vercel (or in production serverless mode).
- **Embeds**:
  - `<script src="https://your-domain/embed/chatbot.js"></script>` loaded from the deployed origin.
  - No hard‑coded `localhost` URLs are required in production.

---

This overview should be sufficient to:
- Map every visible feature to a pricing tier.
- Understand the underlying technical stack.
- See exactly what a Viewer vs Member vs Admin/Owner can do across the product.














[ new added]





# WriteHub AI - Technical Capabilities & Architecture Specification

## 🛠 **System Architecture**
WriteHub AI is built on a modern, scalable serverless architecture designed for high performance, security, and extensibility.

*   **Frontend:** React (Vite) + Tailwind CSS + Shadcn UI
*   **Backend:** Node.js / Express (Serverless-ready via Vercel)
*   **Database:** Supabase (PostgreSQL) with Row Level Security (RLS)
*   **AI Engine:** Google Gemini Pro / Flash (v1beta) via Google Generative AI SDK
*   **Integration Layer:** Composio SDK for external tool execution

---

## ⚙️ **Detailed Functionalities by Module**

### **1. Top Navigation & Dashboard**
*   **Route Architecture:** Client-side routing via `react-router-dom` with protected route wrappers (`AuthGuard`).
*   **State Management:** Real-time data fetching using Supabase subscriptions for live updates (e.g., credit balance changes).

### **2. Agent Builder & Configuration**
*   **Agent Service:**
    *   `agents` table: Stores system instructions, model config parameters (`temperature`, `top_k`), and enabled tools.
    *   `widget_settings` JSONB column: flexible schema for storing UI customizations (primary color, welcome text) without migration overhead.
*   **Embed Code Generation:** Dynamic generation of `script` tags with unique `botId` and public `apiKey`.

### **3. Inbox & Human Escalation System**
*   **Real-time Synchronization:**
    *   **Polling:** Optimized polling interval (3s) for fetching new messages in active sessions.
    *   **Escalation Logic:** Database-driven status flags (`active` vs `escalated`).
*   **Message Handling:**
    *   **Role Management:** Distinct `user`, `assistant`, and `system` roles stored in `agent_messages`.
    *   **Human Override:** API endpoint `/api/agents/reply` allows authorized users (checked via RLS) to inject messages into the stream, effectively bypassing the AI loop.

### **4. Specialized Capabilities (Vision & Files)**
*   **Vision Engine:**
    *   **Input:** Accepts base64 encoded images or URLs.
    *   **Processing:** Server-side fetch -> ArrayBuffer -> Base64 conversion -> Gemini Vision API.
    *   **Security:** Validates MIME types against `image/*`.
*   **Document Analysis Engine:**
    *   **Support:** `.txt`, `.md`, `.csv`, `.json`, `.js`.
    *   **Mechanism:** Fetches file from Storage -> Reads text content -> Truncates to 10k chars (context window optimization) -> Injects as "System Context" for the AI.
*   **Tool Execution (Composio):**
    *   **Sandboxing:** Tools run in isolated environments managed by Composio.
    *   **Auth:** Managed OAuth 2.0 flows for third-party apps (GitHub, Slack, etc.).

### **5. Settings & Administration**
*   **Organization Security (RLS):**
    *   All database queries are scoped by `organization_id`. Users can only access data belonging to their org.
    *   `organization_members` table controls access rights (Owner/Member).
*   **API Key Management:**
    *   **Storage:** `organization_api_keys` table.
    *   **Validation:** Middleware checks `x-api-key` header against hashed keys in DB for every widget request.
*   **Billing Infrastructure:**
    *   **Stripe Integration:** Server-side Checkout Sessions.
    *   **Webhooks:** Secure `checkout.session.completed` handling with idempotency (prevents double-crediting).
    *   **Credit Ledger:** ACID-compliant transactions in `credits_transactions` table.

### **6. Embeddable Widget (Client-Side)**
*   **Isolation:** Shadow DOM encapsulation prevents CSS bleeding from/to the host site.
*   **Performance:**
    *   **Lazy Loading:** Widget initializes only after main page load.
    *   **Asset Optimization:** SVGs used for icons (no font dependencies).
*   **Capabilities:**
    *   **Voice Input:** Native Web Speech API integration (SpeechRecognition).
    *   **File Upload:** Chunked upload to Supabase Storage `chat-attachments` bucket (public access policy).
    *   **Cross-Origin:** Configured CORS policies to allow requests from any domain (for broad embedding).

---

## 📊 **Pricing Drivers (Technical)**
*   **Compute:** AI Token usage (Input/Output + Vision processing).
*   **Storage:** Hosting size for user-uploaded attachments (Images/Docs).
*   **Database:** Row volume for long chat histories (`agent_messages`).
*   **API Calls:** Frequency of tool executions (Composio actions).
*   **Bandwidth:** Media serving via Supabase Storage CDN.

