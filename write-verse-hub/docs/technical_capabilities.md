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
