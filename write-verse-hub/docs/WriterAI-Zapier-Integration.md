WriterAI + Zapier Integration Guide
Overview
This document provides complete instructions to integrate Zapier Partner Embed into WriterAI, enabling users to connect generated content to 5,000+ external apps without leaving the platform.

WriterAI will expose custom triggers and actions to Zapier, allowing automation such as:

Trigger: When workflow completes → Action: Post result to Slack, HubSpot, Notion, etc.

Trigger: When custom agent generates response → Action: Save to Google Sheets

Trigger: When embedded chatbot captures lead → Action: Create contact in CRM

Architecture Overview
text
┌─────────────────────────┐
│   WriterAI Dashboard    │
│  (React + Tailwind)     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Zapier Embed Component │
│  (Workflow Templates)   │
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────┐    ┌──────────────────┐
│ Zapier   │    │ WriterAI Backend  │
│ Platform │◄──►│ (Webhooks + API)  │
└──────────┘    └──────────────────┘
    │
    ▼
┌──────────────────────────┐
│ 5,000+ External Apps     │
│ (Slack, HubSpot, etc.)   │
└──────────────────────────┘
Step 1: Register as Zapier Partner
1.1 Create Zapier Developer Account
Go to zapier.com/app/developer

Sign up with your WriterAI email

Verify your email

Accept Zapier Partner agreement

1.2 Create Your App Integration
Click "Create a New Integration"

Fill in details:

App Name: WriterAI

Description: "Connect WriterAI content generation to 5,000+ apps"

Category: Content & Documents

Logo URL: Your WriterAI logo

You'll receive:

Client ID (e.g., DH6yfoy5OrDnhZ20JngUPvL2nBwESF7tOVXRSon9)

API Key for development

Redirect URL (for OAuth)

Save these securely — you'll need them throughout integration.

Step 2: Set Up Authentication (OAuth2)
2.1 Configure OAuth2 in Zapier
In Zapier Developer Dashboard:

Go to Authentication tab

Choose OAuth 2.0

Fill in:

Client ID: (from Step 1.2)

Authorization URL: https://yourdomain.com/api/auth/authorize

Access Token URL: https://yourdomain.com/api/auth/token

Scope: read write

2.2 Implement OAuth Endpoints in WriterAI Backend
In your Express backend (Node.js):

javascript
// api/auth/authorize.ts
import { Router } from 'express';

const router = Router();

router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, state } = req.query;
  
  // Validate client_id matches your Zapier registration
  if (client_id !== process.env.ZAPIER_CLIENT_ID) {
    return res.status(400).json({ error: 'Invalid client_id' });
  }
  
  // Redirect user to WriterAI login if not authenticated
  res.redirect(`/login?redirect_uri=${redirect_uri}&state=${state}`);
});

// api/auth/token.ts (after user approves)
router.post('/token', async (req, res) => {
  const { code, client_id, client_secret, grant_type } = req.body;
  
  // Validate credentials
  if (client_secret !== process.env.ZAPIER_CLIENT_SECRET) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate access token
  const accessToken = generateAccessToken(client_id, code);
  
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600
  });
});

export default router;
Step 3: Define Custom Triggers
Triggers tell Zapier "when X happens in WriterAI, trigger a Zap."

3.1 Trigger 1: Workflow Execution Completed
In Zapier Developer Dashboard:

Go to Triggers tab

Click Add Trigger

Configure:

Name: Workflow Completed

Description: Trigger when a workflow finishes executing

Key: workflow_completed

Type: Webhook (instant)

Webhook endpoint in WriterAI:

javascript
// api/webhooks/zapier/workflow-completed.ts
import axios from 'axios';

export async function notifyZapierWorkflowComplete(workflowResult) {
  const webhookUrls = await getZapierWebhooks('workflow_completed');
  
  for (const url of webhookUrls) {
    await axios.post(url, {
      event: 'workflow_completed',
      workflowId: workflowResult.workflowId,
      workflowName: workflowResult.workflowName,
      content: workflowResult.finalOutput,
      tokens_used: workflowResult.tokensUsed,
      credits_used: workflowResult.creditsUsed,
      user_id: workflowResult.userId,
      account_id: workflowResult.accountId,
      timestamp: new Date().toISOString()
    });
  }
}

// In your workflow execution code:
const result = await executeWorkflow(workflowData);
await notifyZapierWorkflowComplete(result);
3.2 Trigger 2: Custom Agent Response Generated
javascript
// api/webhooks/zapier/agent-response.ts
export async function notifyZapierAgentResponse(agentResult) {
  const webhookUrls = await getZapierWebhooks('agent_response');
  
  for (const url of webhookUrls) {
    await axios.post(url, {
      event: 'agent_response',
      agentId: agentResult.agentId,
      agentName: agentResult.agentName,
      userMessage: agentResult.userMessage,
      agentResponse: agentResult.response,
      conversationId: agentResult.conversationId,
      tokens_used: agentResult.tokensUsed,
      user_id: agentResult.userId,
      timestamp: new Date().toISOString()
    });
  }
}
3.3 Trigger 3: Embedded Chatbot Lead Captured
javascript
// api/webhooks/zapier/lead-captured.ts
export async function notifyZapierLeadCaptured(leadData) {
  const webhookUrls = await getZapierWebhooks('lead_captured');
  
  for (const url of webhookUrls) {
    await axios.post(url, {
      event: 'lead_captured',
      botId: leadData.embedBotId,
      email: leadData.email,
      name: leadData.name,
      phone: leadData.phone,
      website: leadData.website,
      conversationId: leadData.conversationId,
      timestamp: new Date().toISOString()
    });
  }
}
Step 4: Define Custom Actions
Actions tell Zapier "when a Zap triggers, do X in WriterAI."

4.1 Action: Generate Content
In Zapier Developer Dashboard:

Go to Actions tab

Click Add Action

Configure:

Name: Generate Content

Description: Generate content using WriterAI tools

Key: generate_content

Type: HTTP POST

Backend endpoint:

javascript
// api/zapier/actions/generate.ts
import express from 'express';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { toolName, inputs, userId, accessToken } = req.body;
  
  // Verify Zapier access token
  const user = await verifyZapierToken(accessToken);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Execute WriterAI tool
  const result = await executeWriterAITool({
    tool: toolName, // 'blog_post', 'email', 'summary', etc.
    inputs: inputs,
    userId: user.id,
    model: 'gemini-2.0-flash'
  });
  
  // Track credit usage
  await trackUsage({
    userId: user.id,
    source: 'zapier',
    action: 'generate_content',
    creditsUsed: result.creditsUsed
  });
  
  res.json({
    success: true,
    content: result.output,
    tokens_used: result.tokensUsed,
    credits_used: result.creditsUsed
  });
});

export default router;
Step 5: Embed Zapier in WriterAI Dashboard
5.1 Install Zapier SDK
In your React project:

bash
npm install @zapier/embed
5.2 Create Integrations Tab Component
jsx
// components/IntegrationsTab.jsx
import React, { useEffect } from 'react';
import { ZapierEmbed } from '@zapier/embed';
import { useAuth } from '../context/AuthContext';
import { trackAnalytics } from '../utils/analytics';

export default function IntegrationsTab() {
  const { user, currentAccount } = useAuth();
  
  useEffect(() => {
    // Load Zapier Embed SDK
    const script = document.createElement('script');
    script.src = 'https://zapier.com/apps/embed/embed.js';
    document.head.appendChild(script);
  }, []);
  
  const handleZapierIntegration = () => {
    trackAnalytics('zapier_integration_opened', {
      account_id: currentAccount.id,
      user_id: user.id
    });
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Integrations</h2>
      
      {/* Zapier Embed with Quick Account Creation */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">
          Connect to 5,000+ Apps with Zapier
        </h3>
        <p className="text-gray-600 mb-4">
          Automate your WriterAI workflows. Send generated content to Slack, HubSpot, Notion, and more.
        </p>
        
        <div
          id="zapier-embed"
          className="border border-gray-200 rounded-lg p-4"
          onClick={handleZapierIntegration}
        >
          <zapier-workflow
            sign-up-email={user.email}
            sign-up-first-name={user.firstName}
            sign-up-last-name={user.lastName}
            client-id={process.env.REACT_APP_ZAPIER_CLIENT_ID}
          />
        </div>
      </div>
      
      {/* Connected Zaps Display */}
      <div className="mt-8">
        <h4 className="text-lg font-semibold mb-3">Your Active Zaps</h4>
        <ConnectedZaps accountId={currentAccount.id} />
      </div>
    </div>
  );
}

// Subcomponent: Show connected Zaps
function ConnectedZaps({ accountId }) {
  const [zaps, setZaps] = React.useState([]);
  
  React.useEffect(() => {
    fetchConnectedZaps(accountId).then(setZaps);
  }, [accountId]);
  
  return (
    <div className="space-y-3">
      {zaps.length === 0 ? (
        <p className="text-gray-500">No connected Zaps yet</p>
      ) : (
        zaps.map(zap => (
          <div
            key={zap.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div>
              <p className="font-medium">{zap.title}</p>
              <p className="text-sm text-gray-600">{zap.description}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                zap.isEnabled
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {zap.isEnabled ? 'Active' : 'Paused'}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
5.3 Add Zapier in App Layout
jsx
// pages/Dashboard.jsx
import React, { useState } from 'react';
import IntegrationsTab from '../components/IntegrationsTab';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('workflows');
  
  return (
    <div className="p-6">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-2 rounded ${
            activeTab === 'workflows'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100'
          }`}
        >
          Workflows
        </button>
        
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 rounded ${
            activeTab === 'integrations'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100'
          }`}
        >
          Integrations
        </button>
      </div>
      
      {activeTab === 'workflows' && <WorkflowsTab />}
      {activeTab === 'integrations' && <IntegrationsTab />}
    </div>
  );
}
Step 6: Track Zapier Events with Mixpanel
6.1 Track Integration Usage
javascript
// utils/analytics.js
import mixpanel from 'mixpanel-browser';

export function trackZapierEvent(eventName, properties) {
  mixpanel.track(`zapier_${eventName}`, {
    ...properties,
    timestamp: new Date().toISOString(),
    source: 'zapier_integration'
  });
}

// Usage in your trigger functions:
export async function notifyZapierWorkflowComplete(workflowResult) {
  // ... previous code ...
  
  // Track event
  trackZapierEvent('workflow_triggered', {
    workflow_id: workflowResult.workflowId,
    account_id: workflowResult.accountId,
    tokens_used: workflowResult.tokensUsed
  });
}
6.2 Create Mixpanel Dashboard
Create a saved report in Mixpanel to track:

Total Zaps created by your users

Most popular triggers/actions

Zapier user retention

Revenue from Zapier-driven usage

Step 7: Zap Templates
Create pre-built templates so users don't start from scratch.

7.1 Template 1: Blog Post to Slack
Trigger: WriterAI Workflow Completed
Action: Send message to Slack

Template data:

json
{
  "name": "Post WriterAI Blog to Slack",
  "description": "When you finish a blog workflow, share it to Slack",
  "trigger": {
    "app": "writai",
    "event": "workflow_completed"
  },
  "action": {
    "app": "slack",
    "event": "send_message"
  }
}
7.2 Template 2: Lead to HubSpot
Trigger: Lead Captured on Embedded Chatbot
Action: Create contact in HubSpot

json
{
  "name": "Chatbot Leads to HubSpot",
  "description": "Add leads from your embedded chatbot to HubSpot",
  "trigger": {
    "app": "writai",
    "event": "lead_captured"
  },
  "action": {
    "app": "hubspot",
    "event": "create_contact"
  }
}
7.3 Template 3: Email to Google Sheets
Trigger: Email Generated
Action: Add row to Google Sheet

json
{
  "name": "Save Generated Emails to Google Sheets",
  "description": "Automatically log all generated emails in a spreadsheet",
  "trigger": {
    "app": "writai",
    "event": "content_generated",
    "filter": { "tool": "email_generator" }
  },
  "action": {
    "app": "google_sheets",
    "event": "add_row"
  }
}
Step 8: Testing & Deployment
8.1 Local Testing
bash
# Test your OAuth flow
curl -X GET "http://localhost:3000/api/auth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback"

# Test webhook
curl -X POST "http://localhost:3000/api/webhooks/zapier/workflow-completed" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "test-123",
    "content": "Generated blog post content",
    "tokens_used": 1500
  }'
8.2 Deploy to Production
bash
# Set environment variables
export ZAPIER_CLIENT_ID="your_client_id"
export ZAPIER_CLIENT_SECRET="your_client_secret"
export ZAPIER_REDIRECT_URI="https://yourdomain.com/auth/zapier/callback"

# Deploy to Vercel
vercel --prod
8.3 Update Zapier Dashboard
Go to Zapier Developer Dashboard

Update Authorization URL: https://yourdomain.com/api/auth/authorize

Update Token URL: https://yourdomain.com/api/auth/token

Update Webhook URLs for all triggers

Click Request Public Beta (after testing)

Step 9: Publish to Zapier App Store
9.1 Requirements
✅ 3+ working triggers/actions

✅ 10+ Zap templates created

✅ OAuth2 fully implemented

✅ 50+ active Zapier users (minimum)

✅ Documentation complete

9.2 Submission Checklist
 All triggers and actions documented

 Error handling implemented

 Rate limiting configured (50 requests/minute)

 API responses include helpful error messages

 Support email provided (support@writeral.com)

 Privacy policy updated

 Terms of service updated

9.3 Submit for Review
Go to Zapier Developer Dashboard

Click "Request Public Beta"

Provide:

App description (2-3 sentences)

Support documentation link

Support email

Logo and screenshots

Review time: 1-2 weeks

Troubleshooting
Issue: OAuth Token Not Working
Solution:

Verify client_secret is correct

Check token expiration (default: 3600 seconds)

Ensure access token is passed in Authorization header: Bearer {token}

Issue: Webhooks Not Firing
Solution:

Verify webhook URLs are stored in database

Check that trigger conditions are met

Add logging: console.log('Triggering webhook to:', webhookUrl)

Test with Zapier's webhook URL manually

Issue: Quick Account Creation Not Working
Solution:

Verify all 3 fields passed: sign-up-email, sign-up-first-name, sign-up-last-name

Verify client-id is correct

Check browser console for errors

Ensure script is loaded: https://zapier.com/apps/embed/embed.js

Best Practices
Always verify tokens before allowing actions

Implement rate limiting to prevent abuse (50 requests/minute per user)

Log all webhook events for debugging

Monitor Zapier integration performance via Mixpanel

Update documentation when adding new triggers/actions

Test thoroughly in development before deploying to production

Provide clear error messages for webhook failures

Handle retries for failed webhook deliveries (implement backoff)

Security Considerations
Never expose client_secret in frontend code

Validate all webhook requests from Zapier using request signatures

Use HTTPS for all API endpoints

Implement CORS properly to prevent unauthorized access

Rotate API keys regularly (quarterly minimum)

Audit logs for all Zapier-related activity

Support & Resources
Zapier Documentation: https://docs.zapier.com/

Zapier Partner Community: https://community.zapier.com/

WriterAI Support: [it is actually me, and we are talking]

Test Zapier Integration: https://zapier.com/test-app

Last Updated: November 27, 2025
Maintained By: WriterAI Engineering Team
Status: Production Ready