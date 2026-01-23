# Composio Integration Guide

## Current Status (Disabled in UI)
As of December 2025, the Composio integration backend is fully functional for **Gmail** but the UI access has been temporarily disabled in the Agent Editor (`src/pages/agents/AgentBuilder.tsx`) to simplify the MVP scope.

## Implementation Overview

### 1. Backend Logic
- **Library**: `server/lib/composio.js`
  - Handles client initialization.
  - Manages `executeTool` logic (wrapper around `client.tools.executeComposioTool`).
  - **Caching**: Implements in-memory caching for raw tool definitions to improve performance.
  - **Auth Configs**: `AUTH_CONFIG_IDS` constant maps app names (e.g., 'gmail') to Composio Dashboard Auth Config IDs.

- **Agent Execution**: `server/agents.js`
  - `executeAgentTool`: Resolves `connectionId` based on the tool's app prefix (e.g., `GMAIL_...`).
  - Calls `composio.executeTool` with the correct context (`userId`, `connectionId`).
  - Logs execution results to the database via `log_tool_execution` RPC.

### 2. Database Schema
- **`agent_integrations`**: Stores the link between an agent and a connected account.
  - Columns: `agent_id`, `connection_id`, `app_name`, `connection_status`.
- **`agent_messages`**: Stores chat history.
  - **Important**: Requires a `metadata` column (JSONB) to track tool usage details. (See `sql/SQL53_add_metadata.sql`).

### 3. Frontend Components
- **`src/components/AgentIntegrations.tsx`**: The main component for listing available apps and handling the "Connect" OAuth flow.
- **`src/pages/agents/AgentBuilder.tsx`**: Embeds `AgentIntegrations`. Currently commented out.

## How to Re-enable Integrations

1. Open `src/pages/agents/AgentBuilder.tsx`.
2. Locate the "Integrations Section" comment (around line 250).
3. Uncomment the block rendering `<AgentIntegrations />`.
4. Comment out or remove the "Coming Soon" placeholder div.

## How to Add New Integrations (Future)

To add support for a new app (e.g., Slack, Notion):

1. **Composio Dashboard**:
   - Go to your Composio Dashboard.
   - Create a new "Integration" or "Auth Config" for the desired app.
   - Copy the **Auth Config ID** (e.g., `ac_xxxxxxx`).

2. **Server Configuration**:
   - Open `server/lib/composio.js`.
   - Add the new app to the `AUTH_CONFIG_IDS` object:
     ```javascript
     const AUTH_CONFIG_IDS = {
       'gmail': 'ac_qBcz-RYPTACX',
       'slack': 'ac_NEW_SLACK_ID', // Add this
     };
     ```
   - (Optional) Update `getAvailableApps` in the same file if you want to explicitly control the list, although the frontend currently maps through `popularApps`.

3. **Frontend**:
   - No changes needed if the app is in the `popularApps` list in `server/lib/composio.js`. The `AgentIntegrations` component fetches this list dynamically.

## Troubleshooting

- **"Toolkit version not specified"**: This means `executeComposioTool` is not receiving the correct `version` or `rawTool` object. Ensure `getRawToolsForApp` in `server/lib/composio.js` is fetching the tool definition correctly.
- **"Connected account entity id does not match"**: Ensure `connectionId` is correctly passed from `agents.js` to `composio.executeTool`.
- **Messages disappearing**: Ensure `agent_messages` table has the `metadata` column.
