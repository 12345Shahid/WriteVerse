# Workflows & Custom Agents: Feature Status & Documentation

## 1. Custom Agents
Custom Agents allow users to create specialized AI assistants with specific personalities, instructions, and access to knowledge base files.

### Current Features
- **Agent Creation**: Users can define an agent's name, role/description, and custom system instructions.
- **Knowledge Base Integration**:
    - Agents can be linked to specific files from the Knowledge Base.
    - When chatting, the agent uses RAG (Retrieval Augmented Generation) to answer based on the selected files.
- **Chat Interface**:
    - Dedicated chat UI for each agent.
    - Supports file attachments (images/PDFs) in the chat for context.
    - **Session Management**: Chat history is preserved per session but isolated between agents (fixed in recent updates).
- **Tagging**: Agents can be tagged for organization (e.g., "Marketing", "Support").
- **Model**: Uses Google Gemini models (e.g., `gemini-2.0-flash`) for inference.

### Usage
1.  Go to **Custom Agents** in the dashboard.
2.  Click **Create Agent**.
3.  Fill in the details and select Knowledge Base files if needed.
4.  Click **Start Chat** to interact.

---

## 2. Workflows
Workflows allow users to chain multiple AI tools together into a sequential process.

### Current Features
- **Multi-Step Execution**: Define up to 6 sequential steps.
- **Tool Selection**: Each step uses one of the standard WriterAI tools (e.g., Blog Post Writer, Email Generator, Summarizer).
- **Variable Substitution**:
    - Steps can use outputs from previous steps using `{{stepN.result.text}}` syntax.
    - Example: Step 2 can summarize the blog post generated in Step 1.
- **Tagging**: Workflows can be tagged for easier filtering.

### Recent Bug Fixes (Nov 26)
- **Fixed**: Workflow variable substitution now supports **partial string interpolation**.
    - Before: Only exact matches `{{step1.body}}` worked.
    - Now: Strings like `"Critique: {{step1.body}}"` resolve correctly.
- **Fixed**: Robust JSON parsing for AI tool outputs.
    - Added `parseJSONSafe` to handle cases where Gemini returns extra text or markdown fences that broke parsing.
    - **Confirmed**: Server restarted to apply these fixes.

### Usage
1.  Go to **Workflows**.
2.  Click **Create Workflow**.
3.  Add steps, selecting the tool and defining inputs (or mapping variables).
4.  Run the workflow to execute all steps in order.

### Limitations
- **Custom Agents in Workflows**: ✅ **SUPPORTED**.
    - Workflows can now use `tool: "custom_agent"` with `params: { agentId: "..." }`.
- **Conditionals**: ✅ **SUPPORTED**.
    - Use `"if": "{{step1.text}} contains 'AI'"` to skip steps dynamically.
- **Loops**: ✅ **SUPPORTED**.
    - Use `"loop": { "count": 3 }` or `"loop": { "items": "{{step1.list}}" }` to iterate steps.

---

## 3. Vercel Deployment Status (Critical)
**Status Check Date:** Nov 25, 2025

The Vercel deployment backend logic has been **FIXED** locally.
Also fixed a local development error (`runWorkflow` import missing in `server/index.js`).

### Diagnosis & Fixes
The local development uses `server/index.js` (Express app) which contains all the new routes. The Vercel `api/` directory was previously missing these routes.

### Applied Fixes (Ready for Deploy)
The following endpoints have been ported to Vercel Serverless Functions in `api/`:
| Feature | Status | Fix Applied |
| :--- | :--- | :--- |
| **Workflows** | ✅ **Fixed** | Created `api/workflows/[id]/execute.ts` and `api/_lib/workflow-engine.ts`. |
| **Brand Voice** | ✅ **Fixed** | Created `api/brand-voices/` endpoints and updated `api/generate.ts` to inject voice. |
| **Custom Agents** | ✅ **Ready** | Verified `api/agents/chat.ts` and ensured it uses shared knowledge search logic. |
| **Knowledge Base** | ✅ **Fixed** | Created `api/knowledge/search.ts` for RAG support. |
| **Tags** | ✅ **Fixed** | Created `api/tags/` endpoints for list, create, delete, assign, remove. |
| **Team Chat** | ✅ **Fixed** | Created `api/chat/threads/` endpoints for team collaboration. |

### Recommended Action
**DEPLOY NOW**. The code is ready. Run `vercel --prod` to push these changes to production.
