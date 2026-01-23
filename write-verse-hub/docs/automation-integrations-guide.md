# Automation & Integrations Implementation Guide

## Overview

This document outlines the strategy for implementing:
1. **Automation Platform** - User-built workflow automations (like Zapier)
2. **30+ App Integrations** - Gmail-like read/write/draft functionality for 30 providers

---

## Part 1: Automation Platform

### Choice: Activepieces

| Aspect | Details |
|--------|---------|
| **Platform** | Activepieces (open-source) |
| **Deployment** | Cloud or Self-hosted (TBD) |
| **Free Tier** | 1,000 tasks/month (cloud), unlimited (self-host) |
| **Why Chosen** | No approval process, open-source, embeddable |

### Activepieces Features
- Drag-and-drop workflow builder
- Webhooks and direct API calls
- 100+ pre-built connectors
- Self-hosting option for unlimited usage
- White-label friendly

### Integration Approach (Future)
1. Embed Activepieces UI within WriteVerse
2. OR use Activepieces API to trigger workflows
3. OR self-host and customize for deeper integration

---

## Part 2: 30+ App Integrations Strategy

### Platform Choice: Nango (Primary) + Composio (Backup)

| Platform | Role | When to Use |
|----------|------|-------------|
| **Nango** | Primary OAuth handler | Most integrations |
| **Composio** | AI-first actions | Already integrated for some tools |
| **Custom** | Fallback | If provider not in Nango/Composio |

### Architecture: Hybrid Router Pattern

```
User Request (e.g., "Read my Gmail")
         ↓
   /api/integrations/[provider]/[action]
         ↓
   ┌─────────────────────────────────┐
   │   Common Auth Handler (Nango)   │
   │   - Get connection              │
   │   - Validate token              │
   │   - Refresh if expired          │
   └─────────────────────────────────┘
         ↓
   ┌─────────────────────────────────┐
   │   Action Dispatcher             │
   │   - Read / Write / Draft        │
   │   - List / Search / Delete      │
   └─────────────────────────────────┘
         ↓
   ┌─────────────────────────────────┐
   │   Provider-Specific API Call    │
   │   - Gmail REST API              │
   │   - Slack API                   │
   │   - Notion API, etc.            │
   └─────────────────────────────────┘
         ↓
   Response to User
```

### File Structure

```
api/integrations/
├── _lib/
│   ├── auth.ts           # Common Nango auth handler
│   ├── dispatcher.ts     # Action dispatcher
│   └── types.ts          # Shared types
├── gmail/
│   ├── read.ts           # Read emails
│   ├── send.ts           # Send email
│   └── draft.ts          # Create draft
├── slack/
│   ├── read.ts           # Read messages
│   └── send.ts           # Send message
├── notion/
│   ├── read.ts           # Read pages
│   └── write.ts          # Create/update page
├── wordpress/
│   ├── connect.ts        # ✅ Exists
│   └── publish.ts        # ✅ Exists & Activated
└── [provider]/
    └── [action].ts
```

### Common Auth Handler (`_lib/auth.ts`)

```typescript
// Pseudocode for common auth pattern
export async function getProviderConnection(
  provider: string, 
  userId: string
): Promise<{ accessToken: string; config: any }> {
  const nango = new Nango({ secretKey: NANGO_SECRET_KEY });
  const connection = await nango.getConnection(provider, userId);
  
  if (!connection) {
    throw new AuthError(`${provider} not connected`, { needsAuth: true });
  }
  
  return {
    accessToken: connection.credentials.access_token,
    config: connection.connection_config
  };
}
```

---

## Part 3: Target Integrations (30 Providers)

### Priority 1: Essential (First 10)
| Provider | Actions | OAuth Provider | Complexity |
|----------|---------|----------------|------------|
| Gmail | read, send, draft | Nango | Medium |
| Google Docs | read, write | Nango | Easy |
| Google Sheets | read, write | Nango | Easy |
| Google Drive | read, upload | Nango | Easy |
| Google Calendar | read, create | Nango | Easy |
| Slack | read, send | Nango | Easy |
| Notion | read, write | Nango | Easy |
| WordPress | publish, draft | Nango ✅ | Done |
| Trello | read, create | Nango | Easy |
| Asana | read, create | Nango | Easy |

### Priority 2: Communication (Next 10)
| Provider | Actions | Notes |
|----------|---------|-------|
| Microsoft Outlook | read, send | Via MS Graph |
| Microsoft Teams | read, send | Via MS Graph |
| Discord | read, send | Bot integration |
| LinkedIn | post | Limited API |
| Twitter/X | post | API v2 |
| WhatsApp Business | send | Paid API |
| Telegram | send | Bot API |
| HubSpot | CRM actions | |
| Salesforce | CRM actions | |
| Intercom | messages | |

### Priority 3: Productivity (Final 10)
| Provider | Actions | Notes |
|----------|---------|-------|
| Airtable | read, write | |
| Monday.com | read, create | |
| ClickUp | read, create | |
| Jira | read, create | |
| GitHub | issues, PRs | |
| GitLab | issues, MRs | |
| Dropbox | read, upload | |
| OneDrive | read, upload | |
| Evernote | read, create | |
| Todoist | read, create | |

---

## Part 4: Debugging Strategy

### Server-Side Logging Pattern

```typescript
// Every integration API should use this pattern
console.log(`[Integration][${provider}][${action}] Request:`, {
  userId,
  provider,
  action,
  params: { ...sanitizedParams } // Never log tokens!
});

// On success
console.log(`[Integration][${provider}][${action}] Success:`, {
  resultSummary,
  duration: Date.now() - startTime
});

// On error
console.error(`[Integration][${provider}][${action}] Error:`, {
  error: err.message,
  code: err.code,
  needsAuth: err.needsAuth
});
```

### Client-Side Logging Pattern

```typescript
// Before API call
console.log('[UI][Integration] Starting:', { provider, action });

// On response
console.log('[UI][Integration] Response:', { 
  provider, 
  action, 
  success: response.ok,
  status: response.status
});

// On error
console.error('[UI][Integration] Failed:', { 
  provider, 
  action, 
  error: err.message 
});
```

### Vercel Log Filtering

Use structured log prefixes to filter in Vercel:
- `[Integration][gmail]` - All Gmail logs
- `[Integration][*][Error]` - All errors
- `[UI][Integration]` - All frontend integration logs

---

## Part 5: Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create `api/integrations/_lib/auth.ts`
- [ ] Create `api/integrations/_lib/dispatcher.ts`
- [ ] Create `api/integrations/_lib/types.ts`
- [ ] Test with WordPress integration

### Phase 2: Google Suite (Week 2)
- [ ] Gmail (read, send, draft)
- [ ] Google Docs (read, write)
- [ ] Google Sheets (read, write)
- [ ] Google Drive (read, upload)
- [ ] Google Calendar (read, create)

### Phase 3: Communication Tools (Week 3)
- [ ] Slack (read, send)
- [ ] Notion (read, write)
- [ ] Trello (read, create)
- [ ] Asana (read, create)
- [ ] Discord (read, send)

### Phase 4: Remaining Providers (Week 4-6)
- [ ] Complete remaining 20 integrations
- [ ] Build integration settings UI
- [ ] Add connection management

---

## Part 6: Nango Configuration

### Required Scopes per Provider

| Provider | Scopes |
|----------|--------|
| Gmail | `gmail.readonly`, `gmail.send`, `gmail.compose`, `gmail.drafts` |
| Google Docs | `docs.readonly`, `docs` |
| Google Sheets | `spreadsheets.readonly`, `spreadsheets` |
| Google Drive | `drive.readonly`, `drive.file` |
| Google Calendar | `calendar.readonly`, `calendar.events` |
| Slack | `channels:read`, `chat:write`, `users:read` |
| Notion | `read_content`, `insert_content` |
| WordPress | `posts`, `media` |

### Environment Variables Needed

```env
NANGO_SECRET_KEY=xxx          # Nango API key
NANGO_PUBLIC_KEY=xxx          # For frontend Nango Connect
COMPOSIO_API_KEY=xxx          # Already have
```

---

## Part 7: UI Components Needed

### Integration Connection UI
```
/settings/integrations
├── List of available integrations
├── Connection status per provider
├── "Connect" button → Nango OAuth flow
├── "Disconnect" button
└── Test connection option
```

### Integration Action UI (in Agent/Tools)
```
Agent can:
├── "Read my emails" → triggers Gmail read
├── "Send email to X" → triggers Gmail send
├── "Create a Notion page" → triggers Notion write
└── "Post to WordPress" → triggers WordPress publish
```

---

## Summary

| Aspect | Choice |
|--------|--------|
| Automation | Activepieces (cloud or self-host TBD) |
| OAuth Layer | Nango (primary) |
| Architecture | Hybrid Router Pattern |
| First 10 | Google Suite + Slack + Notion + WordPress |
| Debug Method | Structured console logs with prefixes |
| Time Estimate | ~4-6 weeks for 30 integrations |
