WriterAI + Paragon Integration Guide
Overview
This document provides complete instructions to integrate Paragon (embedded iPaaS) into WriterAI, enabling users to connect their content generation to 130+ pre-built integrations with native, white-labeled UI.

Paragon offers two products:

Connect Portal — Pre-built white-labeled UI for users to authenticate and manage integrations

Workflows — Visual or code-based (TypeScript) engine to build sync and automation logic

WriterAI will use Paragon to:

Let users connect their CRM/marketing/productivity tools directly in your dashboard

Automatically sync generated content (blog posts, emails) to their connected tools

Build workflows like: Content generated → Save to Notion → Post to HubSpot → Send to Slack

Why Paragon Over Zapier?
Feature	Zapier	Paragon
UI Style	Workflow builder (Zapier brand visible)	White-labeled (fully your brand)
Pre-built Integrations	5,000+ (many low-quality)	130+ (enterprise-focused)
Workflow Complexity	Simple trigger-action	Complex multi-step with conditionals
Data Sync	Event-triggered only	Scheduled or real-time bi-directional
Custom Logic	Limited	Full TypeScript support (Paragraph)
Cost	Free embed + $20 Zapier account	$1,000-3,000/month (enterprise)
Best For	Breadth (many apps)	Depth (specific apps, complex flows)
For WriterAI: Use Paragon for native, polished experience with top SaaS tools (Salesforce, HubSpot, Slack, Notion, etc.).

Architecture
text
┌──────────────────────────┐
│   WriterAI Dashboard     │
│   (React + Tailwind)     │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐
│  Paragon Connect Portal  │
│  (White-labeled UI)      │
└──────────────┬───────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────────┐   ┌──────────────────┐
│ Paragon     │   │ WriterAI Backend  │
│ Workflows   │   │ (App Events)      │
│ Engine      │   │ (Webhooks)        │
└─────────────┘   └──────────────────┘
    │
    ▼
┌──────────────────────────┐
│ 130+ Integrations        │
│ (Salesforce, HubSpot,    │
│  Slack, Notion, etc.)    │
└──────────────────────────┘
Step 1: Register as Paragon Partner
1.1 Create Paragon Account
Go to useparagon.com

Click Sign Up

Create account with your WriterAI business email

Verify email

1.2 Create Your Project
In Paragon dashboard, click Create Project

Fill in details:

Project Name: WriterAI

Description: AI-powered writing platform with integration capabilities

Category: AI/Content Tools

You'll receive:

Project ID (e.g., project_abc123)

Public Key (for frontend)

Private Key (keep secure, for backend only)

Signing Key (for user token generation)

1.3 Configure Integrations
Go to Integrations in dashboard

Enable the 130+ pre-built connectors you want to offer:

CRM: Salesforce, HubSpot, Pipedrive, Zoho

Marketing: Mailchimp, ConvertKit, ActiveCampaign

Productivity: Notion, Airtable, Google Sheets

Communication: Slack, Teams, Discord

File Storage: Google Drive, Dropbox, OneDrive

For each, click Enable and configure OAuth if needed

Step 2: Set Up Authentication
2.1 User Token Generation (Backend Only)
Paragon uses user tokens (JWT) to authenticate users. This must be done on your backend for security.

javascript
// api/auth/paragon-token.ts
import jwt from 'jsonwebtoken';

export async function generateParagonUserToken(userId) {
  const token = jwt.sign(
    {
      userId: userId,
      projectId: process.env.PARAGON_PROJECT_ID,
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
    },
    process.env.PARAGON_SIGNING_KEY,
    { algorithm: 'HS256' }
  );
  
  return token;
}

// GET endpoint to fetch token (called by frontend)
app.get('/api/auth/paragon-token', async (req, res) => {
  const userId = req.user.id; // From JWT middleware
  
  const token = await generateParagonUserToken(userId);
  res.json({ token });
});
2.2 Frontend Authentication Setup
jsx
// components/ParagonAuth.js
import { useEffect, useState } from 'react';
import { paragon } from '@useparagon/connect';

export function useParagonAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeParagon = async () => {
      // Get user token from backend
      const response = await fetch('/api/auth/paragon-token');
      const { token } = await response.json();

      // Authenticate with Paragon
      await paragon.authenticate(
        process.env.REACT_APP_PARAGON_PROJECT_ID,
        token
      );

      setIsAuthenticated(true);
    };

    initializeParagon();
  }, []);

  return { isAuthenticated };
}
Step 3: Implement Connect Portal
3.1 Embed in React Component
jsx
// components/IntegrationsTab.jsx
import React, { useEffect, useState } from 'react';
import { paragon } from '@useparagon/connect';
import { useParagonAuth } from './ParagonAuth';
import { trackAnalytics } from '../utils/analytics';

export default function IntegrationsTab() {
  const { isAuthenticated } = useParagonAuth();
  const [connectedIntegrations, setConnectedIntegrations] = useState([]);

  // Available integrations to show
  const availableIntegrations = [
    { id: 'salesforce', name: 'Salesforce', icon: '☁️' },
    { id: 'hubspot', name: 'HubSpot', icon: '📊' },
    { id: 'slack', name: 'Slack', icon: '💬' },
    { id: 'notion', name: 'Notion', icon: '📝' },
    { id: 'airtable', name: 'Airtable', icon: '📋' },
    { id: 'google_sheets', name: 'Google Sheets', icon: '📈' },
    { id: 'mailchimp', name: 'Mailchimp', icon: '📧' },
    { id: 'zapier', name: 'Zapier', icon: '⚡' }
  ];

  useEffect(() => {
    if (isAuthenticated) {
      loadConnectedIntegrations();
    }
  }, [isAuthenticated]);

  const loadConnectedIntegrations = async () => {
    const integrations = await paragon.getConnectedIntegrations();
    setConnectedIntegrations(integrations);
  };

  const handleConnectIntegration = async (integrationId) => {
    try {
      // Open Paragon Connect Portal for specific integration
      paragon.connect(integrationId);

      trackAnalytics('paragon_connection_initiated', {
        integration: integrationId,
        account_id: currentAccount.id
      });
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnectIntegration = async (integrationId) => {
    try {
      await paragon.disconnect(integrationId);
      loadConnectedIntegrations();

      trackAnalytics('paragon_disconnection', {
        integration: integrationId
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (!isAuthenticated) {
    return <div>Loading integrations...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Connected Services</h2>
      
      <p className="text-gray-600 mb-6">
        Connect WriterAI to your favorite tools. Automatically sync your generated 
        content to Salesforce, HubSpot, Notion, and more.
      </p>

      {/* Available Integrations Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {availableIntegrations.map(integration => {
          const isConnected = connectedIntegrations.some(
            i => i.integrationId === integration.id
          );

          return (
            <div
              key={integration.id}
              className="p-4 border rounded-lg text-center cursor-pointer hover:shadow-lg transition"
              onClick={() => 
                isConnected 
                  ? handleDisconnectIntegration(integration.id)
                  : handleConnectIntegration(integration.id)
              }
            >
              <div className="text-3xl mb-2">{integration.icon}</div>
              <p className="font-medium text-sm">{integration.name}</p>
              <p className={`text-xs mt-2 ${
                isConnected 
                  ? 'text-green-600 font-semibold' 
                  : 'text-gray-500'
              }`}>
                {isConnected ? '✓ Connected' : 'Not connected'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Connected Integrations List */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Active Connections</h3>
        {connectedIntegrations.length === 0 ? (
          <p className="text-gray-500">No integrations connected yet</p>
        ) : (
          <div className="space-y-3">
            {connectedIntegrations.map(integration => (
              <div
                key={integration.integrationId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {availableIntegrations.find(
                      i => i.id === integration.integrationId
                    )?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {integration.lastSyncTime && 
                      `Last synced: ${new Date(integration.lastSyncTime).toLocaleString()}`
                    }
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnectIntegration(integration.integrationId)}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
Step 4: Define Workflows
4.1 Option A: Visual Workflow Builder (Dashboard)
In Paragon dashboard:

Go to Workflows

Click Create Workflow

Define trigger: "WriterAI Content Generated"

Add steps:

Step 1: Save to Notion

Step 2: Post to Slack

Step 3: Create HubSpot contact

Example Workflow: Blog Post → Notion + Slack

text
[Trigger] WriterAI Blog Generated
    ↓
[Filter] Topic = "Marketing"
    ↓
[Notion] Create Database Entry
    ├─ Title: Blog post title
    ├─ Content: Generated text
    └─ URL: Publishing link
    ↓
[Slack] Send Message to #marketing
    └─ Message: "New blog posted: [Title]"
4.2 Option B: Code-Based Workflow (Paragraph)
For advanced workflows, use Paragraph (TypeScript):

typescript
// workflows/content-to-integrations.ts
import { Paragon } from '@useparagon/paragraph';

const workflow = new Paragon.Workflow({
  id: 'content_to_integrations',
  name: 'Distribute Generated Content',
  description: 'Send blog posts to connected tools'
});

// Trigger: WriterAI event
workflow.onAppEvent('content.generated', async (event) => {
  const { title, content, contentType, userId } = event.data;

  // Step 1: Save to Notion if connected
  const notionConnected = await paragon.isConnected(userId, 'notion');
  if (notionConnected) {
    await paragon.actions.notion.createDatabaseEntry(
      {
        title: title,
        content: content,
        type: contentType,
        createdAt: new Date()
      }
    );
  }

  // Step 2: Create HubSpot contact
  const hubspotConnected = await paragon.isConnected(userId, 'hubspot');
  if (hubspotConnected) {
    await paragon.actions.hubspot.createContact({
      firstName: 'Content',
      lastName: 'Generated',
      email: userId,
      properties: {
        latest_content: title,
        content_type: contentType
      }
    });
  }

  // Step 3: Post to Slack
  const slackConnected = await paragon.isConnected(userId, 'slack');
  if (slackConnected) {
    await paragon.actions.slack.sendMessage({
      channel: '#writai-content',
      text: `🎉 New ${contentType} created: *${title}*`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${title}*\n${content.substring(0, 100)}...` }
        }
      ]
    });
  }

  // Log to analytics
  await trackWorkflowExecution(userId, {
    workflows_triggered: [
      { if: notionConnected, name: 'notion_sync' },
      { if: hubspotConnected, name: 'hubspot_contact' },
      { if: slackConnected, name: 'slack_post' }
    ]
  });
});

export default workflow;
Step 5: Send App Events from WriterAI
When content is generated, notify Paragon:

javascript
// services/content-generation.js
import { paragon } from '@useparagon/connect';

export async function generateContentWithParagon(
  userId,
  toolName,
  inputs,
  model
) {
  // Generate content using your LLM
  const result = await generateWithGemini({
    tool: toolName,
    inputs: inputs,
    model: model
  });

  // Send app event to Paragon
  try {
    await paragon.sendAppEvent({
      userId: userId,
      eventType: 'content.generated',
      data: {
        title: inputs.topic,
        content: result.output,
        contentType: toolName, // 'blog', 'email', 'social', etc.
        tokensUsed: result.tokensUsed,
        creditsUsed: result.creditsUsed,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to send app event:', error);
    // Don't fail content generation if event fails
  }

  return result;
}

// Usage in your workflow execution:
const result = await generateContentWithParagon(
  user.id,
  'blog_post',
  {
    topic: 'AI Trends 2025',
    wordCount: 2000,
    tone: 'professional'
  },
  'gemini-2.0-flash'
);
Step 6: Track Events with Mixpanel
javascript
// utils/analytics.js
import mixpanel from 'mixpanel-browser';

export async function trackParagonEvent(eventName, properties) {
  mixpanel.track(`paragon_${eventName}`, {
    ...properties,
    timestamp: new Date().toISOString(),
    source: 'paragon_integration'
  });
}

// Usage:
export async function trackWorkflowExecution(userId, workflowData) {
  trackParagonEvent('workflow_executed', {
    user_id: userId,
    workflows_triggered: workflowData.workflows_triggered,
    integration_count: workflowData.workflows_triggered.filter(w => w.if).length
  });
}
Step 7: Custom Integration (Advanced)
If Paragon doesn't have a pre-built connector for a tool you need:

7.1 Create Custom Connector
In Paragon Dashboard:

Go to Custom Integrations

Click Create Custom Connector

Fill in:

App Name: (e.g., "Your CRM")

OAuth Config: (if needed)

API Base URL: (e.g., https://api.yourcrm.com)

Test Request: Make a test API call

7.2 Use in Workflow
typescript
// In Paragraph
workflow.onAppEvent('content.generated', async (event) => {
  const customResult = await paragon.actions.customIntegration.makeRequest({
    method: 'POST',
    endpoint: '/content',
    data: {
      title: event.data.title,
      body: event.data.content
    }
  });
});
Step 8: Deployment
8.1 Environment Variables
bash
PARAGON_PROJECT_ID=project_abc123
PARAGON_PUBLIC_KEY=pk_live_xxx
PARAGON_PRIVATE_KEY=sk_live_xxx
PARAGON_SIGNING_KEY=sign_key_xxx
REACT_APP_PARAGON_PROJECT_ID=project_abc123
8.2 Deploy to Production
bash
# Build frontend with Paragon SDK
npm run build

# Deploy backend with Paragon endpoints
vercel --prod

# Verify in Paragon dashboard:
# 1. App events showing in logs
# 2. Workflows executing successfully
# 3. No authentication errors
Monitoring & Debugging
8.3 Paragon Observability Dashboard
In Paragon dashboard:

Event Logs — View all app events sent

Workflow Runs — See execution history and errors

Integration Health — Monitor connection status

Performance — Track workflow latency

8.4 Common Issues
Issue	Cause	Solution
User token invalid	Expired or wrong signing key	Regenerate token with correct key
App events not received	Wrong event format	Check event schema in Paragon docs
Workflow not triggering	Filter condition not met	Verify trigger data matches filter
Integration connection fails	OAuth expired	User needs to reconnect in Connect Portal
Pricing & Scaling
Paragon Pricing
Plan	Cost	Features
Starter	$1,000/month	100+ integrations, 10K workflows/month
Professional	$3,000/month	Unlimited workflows, custom connectors, support
Enterprise	Custom	On-premise, dedicated support, SLA
Recommendation
MVP: Start with Starter plan ($1,000/month)

Growth: Move to Professional as workflows increase

Enterprise: Custom pricing for large customers

Complete Integration Checklist
 Create Paragon project and get credentials

 Enable 130+ pre-built integrations in Paragon dashboard

 Implement user token generation (backend)

 Embed Connect Portal in React (IntegrationsTab component)

 Create 3-5 pre-built workflows (Notion, Slack, HubSpot)

 Send app events when content generated

 Set up Mixpanel tracking for Paragon events

 Test end-to-end in development

 Deploy to production

 Monitor in Paragon observability dashboard

Last Updated: November 29, 2025
Status: Production Ready
Support: support@writeral.com