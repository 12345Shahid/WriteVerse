# WriteVerse (Enterprise AI Content Platform)

An enterprise-grade, multi-tenant SaaS platform designed for content teams. WriteVerse centralizes 20+ specialized AI writing tools, collaborative team workspaces, autonomous AI agents, and custom workflows into a single powerful dashboard.

## 🎯 Purpose
To replace fragmented AI tool subscriptions by offering a unified workspace. Users can generate SEO blogs, cold emails, scripts, and social threads using multiple AI models (via OpenRouter), while collaborating with their team and executing automated Zapier workflows.

## 📸 Architecture & Workflow

```mermaid
flowchart TD
    subgraph Frontend (React + Vite)
        UI[Dashboard / Tools]
        Team[Team Workspaces]
        Chat[Agent Inbox]
    end

    subgraph Backend API (Express.js)
        API[Core API]
        RAG[Knowledge Base Search]
        Zap[Zapier / Composio Webhooks]
        Bill[Stripe Billing & Metering]
    end

    subgraph External Services
        DB[(Supabase PostgreSQL)]
        LLM[OpenRouter Models]
    end

    UI <-->|JWT Auth & REST| API
    Team <--> API
    Chat <--> API
    
    API <-->|Execute AI| LLM
    API <-->|RAG Vector Search| DB
    API <-->|Read/Write Data| DB
    API <-->|Automation| Zap
    API <-->|Subscriptions| Bill
```

## ✨ Features
*   **20+ Specialized Tools:** Pre-engineered templates for Blogs, Twitter threads, Cover letters, Resumes, Product descriptions, and more.
*   **Autonomous AI Agents:** Deploy specialized agents that have context of your specific Knowledge Base to answer queries or draft content autonomously.
*   **Knowledge Base & RAG:** Upload company documents to ground the AI generation in your actual brand voice and facts.
*   **Team Workspaces:** Multi-tenant architecture allowing users to invite team members, share generated content, and chat internally.
*   **Stripe Billing:** Fully functional tiered subscription and credit-metering system.
*   **Automation:** Integrated with Zapier and Composio for triggering external workflows on content completion.
*   **Embeddable Widget:** Create a custom widget to embed specific AI tools on external websites.

## 🛠️ Tech Stack
*   **Frontend:** React 18, Vite, Tailwind CSS v4, shadcn/ui
*   **Backend:** Node.js, Express.js
*   **Database & Auth:** Supabase (PostgreSQL with 60+ migrations)
*   **AI Engine:** OpenRouter (supporting multiple LLMs)
*   **Payments:** Stripe
*   **Analytics & Monitoring:** Mixpanel, Sentry

## ⚙️ Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   Supabase Account
*   OpenRouter API Key
*   Stripe Account (for billing)

### 1. Clone the repository
```bash
git clone https://github.com/12345Shahid/write-verse-hub.git
cd write-verse-hub/write-verse-hub
```
*(Note: Enter the nested `write-verse-hub` directory where the source code lives)*

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in the extensive configuration for Supabase, Stripe, and OpenRouter:
```bash
cp .env.example .env
```

### 4. Database Setup
This project contains 64 SQL migration files in the `sql/` directory. You must execute these sequentially in your Supabase SQL editor to create the complex schema for users, credits, teams, agents, and knowledge bases.

### 5. Run the Application
The platform requires both the frontend Vite server and the backend Express server to run simultaneously.

```bash
# Run both servers concurrently
npm run dev:all
```
*   **Frontend:** `http://localhost:8080`
*   **Backend API:** `http://localhost:8787`

## 🔮 Future Improvements
*   [ ] Implement WebSocket-based realtime collaboration (Google Docs style) on generated content.
*   [ ] Expand the native Zapier integration to include incoming webhooks (e.g., generate a blog when a new Trello card is created).

---
*Created by [Shahid](https://github.com/12345Shahid)*
