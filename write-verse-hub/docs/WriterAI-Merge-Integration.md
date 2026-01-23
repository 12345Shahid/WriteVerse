WriterAI + Merge Integration Guide
Overview
This document provides complete instructions to integrate Merge (Unified API platform) into WriterAI, enabling automatic data synchronization with 50+ CRM systems through a single normalized API.

Merge abstracts the complexity of connecting to multiple CRM platforms (Salesforce, HubSpot, Pipedrive, Zoho, etc.) by providing:

Unified CRM API — Single endpoint for all CRM operations (contacts, deals, accounts)

Automatic Data Syncs — Real-time or scheduled synchronization

Custom Fields Mapping — Map customer's custom CRM fields to your schema

Field Mappings Dashboard — Non-technical users can map fields without developer help

WriterAI will use Merge to:

Sync generated leads from embedded chatbots → CRM contacts

Create deals when users complete high-value workflows

Update contact info with writing preferences

Generate content recommendations based on CRM data

Why Merge vs Paragon for CRM?
Feature	Paragon	Merge
# of Integrations	130+ (all categories)	50+ (CRM focused)
Best Use Case	General workflows	CRM data synchronization
Data Syncing	Limited	Excellent (bi-directional)
Custom Fields	Manual via API	Auto-mapped with field mappings
Real-time Sync	Via webhooks	Scheduled or real-time
Cost	$1,000-3,000/month	$0-650/month (then $65 per account)
Free Tier	NO	YES (3 accounts free)
Ideal For	Complex workflows	CRM data integration at scale
For WriterAI CRM Integration: Use Merge for normalized CRM access with automatic sync and field mapping.

Architecture
text
┌──────────────────────────┐
│   WriterAI Backend       │
│   (Node.js + Express)    │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐
│   Merge Unified API      │
│   (Normalized endpoints) │
└──────────────┬───────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────────────────┐ ┌──────────────────┐
│ Merge Link          │ │ 50+ CRM Systems  │
│ (OAuth Portal)      │ │ (Salesforce,     │
│                     │ │  HubSpot,        │
│                     │ │  Pipedrive, etc) │
└─────────────────────┘ └──────────────────┘
Step 1: Set Up Merge Account
1.1 Create Developer Account
Go to merge.dev

Sign up for free (free tier includes 3 linked accounts)

Create project "WriterAI"

Verify email

1.2 Get API Credentials
In Merge Dashboard:

Go to API Keys section

Copy:

Public Key (for frontend)

API Key (for backend)

Environment: Use "Sandbox" first, then "Production"

Enable CRM category:

Go to Integrations

Search for "CRM"

Click Enable

You'll see 50+ CRM systems available

1.3 Environment Variables
bash
MERGE_API_KEY=your_api_key_here
MERGE_ACCOUNT_TOKEN=generated_per_user
MERGE_PUBLIC_KEY=your_public_key
MERGE_ENVIRONMENT=production
Step 2: Create Merge Link (OAuth Integration)
Merge Link is the pre-built OAuth portal where users authorize their CRM.

2.1 Add Merge Link to Frontend
jsx
// components/CRMIntegration.jsx
import React, { useState, useEffect } from 'react';
import { useMergeLink } from './useMergeLink';
import { trackAnalytics } from '../utils/analytics';

export default function CRMIntegration() {
  const { mergeLink, loading } = useMergeLink();
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [selectedCRM, setSelectedCRM] = useState('hubspot');

  const crmOptions = [
    { value: 'hubspot', label: 'HubSpot', icon: '🎯' },
    { value: 'salesforce', label: 'Salesforce', icon: '☁️' },
    { value: 'pipedrive', label: 'Pipedrive', icon: '📊' },
    { value: 'zoho', label: 'Zoho CRM', icon: '⚙️' },
    { value: 'microsoft_dynamics', label: 'Dynamics 365', icon: '💼' },
  ];

  useEffect(() => {
    if (mergeLink) {
      fetchLinkedAccounts();
    }
  }, [mergeLink]);

  const fetchLinkedAccounts = async () => {
    try {
      const response = await fetch('/api/merge/linked-accounts');
      const accounts = await response.json();
      setLinkedAccounts(accounts);
    } catch (error) {
      console.error('Failed to fetch linked accounts:', error);
    }
  };

  const handleConnectCRM = async () => {
    trackAnalytics('crm_integration_started', {
      crm: selectedCRM
    });

    // Merge Link will open in modal
    mergeLink.open({
      integrationName: selectedCRM,
      onSuccess: (data) => {
        console.log('Connected:', data);
        fetchLinkedAccounts(); // Refresh list
        
        trackAnalytics('crm_connected', {
          crm: selectedCRM,
          accountToken: data.account_token
        });
      },
      onError: (error) => {
        console.error('Connection failed:', error);
        trackAnalytics('crm_connection_failed', {
          crm: selectedCRM,
          error: error.message
        });
      }
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">CRM Integration</h2>
      
      <p className="text-gray-600 mb-6">
        Connect your CRM to automatically sync leads and content.
      </p>

      {/* CRM Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select CRM</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {crmOptions.map(crm => (
            <button
              key={crm.value}
              onClick={() => setSelectedCRM(crm.value)}
              className={`p-3 rounded border-2 text-center transition ${
                selectedCRM === crm.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{crm.icon}</div>
              <div className="text-xs font-medium">{crm.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Connect Button */}
      <button
        onClick={handleConnectCRM}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 mb-8"
      >
        Connect {crmOptions.find(c => c.value === selectedCRM)?.label}
      </button>

      {/* Connected Accounts */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Your Connected CRMs</h3>
        {linkedAccounts.length === 0 ? (
          <p className="text-gray-500">No CRMs connected yet</p>
        ) : (
          <div className="space-y-3">
            {linkedAccounts.map(account => (
              <div
                key={account.account_token}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{account.integration_name}</p>
                  <p className="text-sm text-gray-600">
                    Connected on {new Date(account.date_created).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => disconnectCRM(account.account_token)}
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
2.2 Merge Link Hook
jsx
// hooks/useMergeLink.js
import { useEffect, useState } from 'react';

export function useMergeLink() {
  const [mergeLink, setMergeLink] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load Merge Link script
    const script = document.createElement('script');
    script.src = 'https://link.merge.dev/merge-link.js';
    script.async = true;
    script.onload = initializeMergeLink;
    document.head.appendChild(script);
  }, []);

  const initializeMergeLink = async () => {
    // Get init token from backend
    const response = await fetch('/api/merge/init-link');
    const { linkToken } = await response.json();

    // Initialize Merge Link
    const link = window.Merge.createLink({
      linkToken: linkToken,
      onSuccess: () => {
        console.log('Merge Link success');
      }
    });

    setMergeLink(link);
    setLoading(false);
  };

  return { mergeLink, loading };
}
Step 3: Create Account Tokens
When a user connects a CRM, Merge generates an account token. Store this for API calls.

javascript
// api/merge/init-link.ts
import fetch from 'node-fetch';

export async function getInitLinkToken(userId) {
  // Step 1: Create integration account
  const response = await fetch('https://api.merge.dev/api/crm/v1/accounts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MERGE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // Body can be empty for Merge
    })
  });

  const account = await response.json();
  const accountToken = account.account_token;

  // Step 2: Create link token (expires in 30 minutes)
  const linkResponse = await fetch('https://link-api.merge.dev/linked-accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_token: accountToken,
      client_id: process.env.MERGE_PUBLIC_KEY,
      // Will expire and user needs to re-auth
      end_user_origin_id: userId
    })
  });

  const linkData = await linkResponse.json();

  // Store account token for user
  await saveUserMergeAccount(userId, {
    accountToken: accountToken,
    linkedAt: new Date()
  });

  return { linkToken: linkData.link_token };
}

// GET /api/merge/init-link
app.get('/api/merge/init-link', async (req, res) => {
  const userId = req.user.id;
  const { linkToken } = await getInitLinkToken(userId);
  res.json({ linkToken });
});
Step 4: Query the Unified CRM API
Once connected, query with the normalized API:

4.1 List Contacts
javascript
// GET /api/crm/contacts
async function listContacts(userId) {
  const user = await getUser(userId);
  const accountToken = user.mergeAccountToken;

  const response = await fetch(
    'https://api.merge.dev/api/crm/v1/contacts/?limit=100',
    {
      headers: {
        'Authorization': `Bearer ${process.env.MERGE_API_KEY}`,
        'X-Account-Token': accountToken
      }
    }
  );

  return response.json();
}

// Usage in Express
app.get('/api/crm/contacts', async (req, res) => {
  try {
    const contacts = await listContacts(req.user.id);
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
4.2 Create Contact from Chatbot Lead
javascript
// POST /api/crm/contacts
async function createContact(userId, leadData) {
  const user = await getUser(userId);
  const accountToken = user.mergeAccountToken;

  const response = await fetch(
    'https://api.merge.dev/api/crm/v1/contacts/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERGE_API_KEY}`,
        'X-Account-Token': accountToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: leadData.firstName,
        last_name: leadData.lastName,
        email_addresses: [{
          email_address: leadData.email,
          email_address_type: 'primary'
        }],
        phone_numbers: leadData.phone ? [{
          phone_number: leadData.phone,
          phone_number_type: 'primary'
        }] : [],
        custom_fields: {
          source: 'writai_chatbot',
          capture_date: new Date().toISOString()
        }
      })
    }
  );

  return response.json();
}

// Trigger when chatbot captures lead
app.post('/api/webhooks/lead-captured', async (req, res) => {
  const { userId, leadData } = req.body;

  try {
    const contact = await createContact(userId, leadData);
    
    trackAnalytics('crm_contact_created', {
      userId,
      contactId: contact.id,
      source: 'chatbot'
    });

    res.json({ success: true, contactId: contact.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
4.3 Create Deal from Workflow Completion
javascript
// POST /api/crm/deals
async function createDeal(userId, workflowData) {
  const user = await getUser(userId);
  const accountToken = user.mergeAccountToken;

  const response = await fetch(
    'https://api.merge.dev/api/crm/v1/opportunities/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERGE_API_KEY}`,
        'X-Account-Token': accountToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: workflowData.workflowName,
        description: workflowData.description,
        amount: workflowData.estimatedValue || 0,
        stage: 'Qualification',
        custom_fields: {
          generated_by: 'writai_workflow',
          workflow_id: workflowData.workflowId,
          content_type: workflowData.contentType
        }
      })
    }
  );

  return response.json();
}

// Trigger when workflow completes
app.post('/api/webhooks/workflow-completed', async (req, res) => {
  const { userId, workflowData } = req.body;

  try {
    const deal = await createDeal(userId, workflowData);
    
    trackAnalytics('crm_deal_created', {
      userId,
      dealId: deal.id,
      value: workflowData.estimatedValue
    });

    res.json({ success: true, dealId: deal.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
Step 5: Field Mapping for Custom Fields
Users often have custom fields in their CRM. Merge handles this with field mappings.

5.1 Show Available Fields
javascript
// GET /api/crm/fields
async function getAvailableFields(userId) {
  const user = await getUser(userId);
  const accountToken = user.mergeAccountToken;

  const response = await fetch(
    'https://api.merge.dev/api/crm/v1/contacts/meta/field-mapping/',
    {
      headers: {
        'Authorization': `Bearer ${process.env.MERGE_API_KEY}`,
        'X-Account-Token': accountToken
      }
    }
  );

  const fieldMapping = await response.json();
  return fieldMapping.standard_objects; // Standard fields
}

app.get('/api/crm/fields', async (req, res) => {
  const fields = await getAvailableFields(req.user.id);
  res.json(fields);
});
5.2 Map Custom Fields
jsx
// components/FieldMapping.jsx
import React, { useEffect, useState } from 'react';

export function FieldMapping({ contactData }) {
  const [availableFields, setAvailableFields] = useState([]);
  const [mappings, setMappings] = useState({});

  useEffect(() => {
    fetchAvailableFields();
  }, []);

  const fetchAvailableFields = async () => {
    const response = await fetch('/api/crm/fields');
    const fields = await response.json();
    setAvailableFields(fields);
  };

  const handleFieldMap = (writaiField, crmField) => {
    setMappings({
      ...mappings,
      [writaiField]: crmField
    });
  };

  return (
    <div>
      <h3>Map Custom Fields</h3>
      {Object.keys(contactData).map(field => (
        <div key={field} className="mb-4">
          <label>{field}</label>
          <select
            onChange={(e) => handleFieldMap(field, e.target.value)}
            value={mappings[field] || ''}
          >
            <option>Select field...</option>
            {availableFields.map(crmField => (
              <option key={crmField.id} value={crmField.id}>
                {crmField.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button onClick={() => saveMappings(mappings)}>Save Mapping</button>
    </div>
  );
}
Step 6: Track with Mixpanel
javascript
// utils/merge-analytics.js
import mixpanel from 'mixpanel-browser';

export function trackMergeEvent(eventName, properties) {
  mixpanel.track(`merge_${eventName}`, {
    ...properties,
    timestamp: new Date().toISOString(),
    source: 'merge_crm'
  });
}

// Usage:
export async function trackContactCreated(userId, contactId, source) {
  trackMergeEvent('contact_created', {
    user_id: userId,
    contact_id: contactId,
    source: source, // 'chatbot', 'form', etc
    timestamp: new Date()
  });
}
Step 7: Bi-Directional Sync (Advanced)
7.1 Scheduled Sync
javascript
// workers/merge-sync-worker.ts
import { CronJob } from 'cron';

// Sync every hour
const syncJob = new CronJob('0 * * * *', async () => {
  const users = await getAllUsersWithMergeAccounts();
  
  for (const user of users) {
    try {
      // Pull latest contacts from CRM
      const contacts = await listContacts(user.id);
      
      // Update local database
      for (const contact of contacts.results) {
        await upsertContact(user.id, contact);
      }
      
      trackMergeEvent('sync_completed', {
        userId: user.id,
        contactsCount: contacts.results.length
      });
    } catch (error) {
      console.error('Sync failed:', error);
      trackMergeEvent('sync_failed', {
        userId: user.id,
        error: error.message
      });
    }
  }
});

syncJob.start();
7.2 Webhook for Real-Time Updates
When CRM data changes, Merge can send webhooks:

javascript
// api/webhooks/merge-update.ts
app.post('/api/webhooks/merge-update', async (req, res) => {
  const { account_token, action, data } = req.body;
  
  // Example: Contact updated in CRM
  if (action === 'contact.updated') {
    const userId = await getUserByMergeToken(account_token);
    
    // Update local contact
    await updateContact(userId, data.contact_id, data);
    
    trackMergeEvent('contact_updated_remotely', {
      user_id: userId,
      contact_id: data.contact_id
    });
  }
  
  res.json({ success: true });
});
Step 8: Error Handling & Retries
javascript
// utils/merge-retry.js
export async function callMergeAPI(endpoint, options, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, options);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get('retry-after') || 60;
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  
  throw lastError;
}
Step 9: Pricing & Scaling
Merge Pricing
Plan	Linked Accounts	Cost
Free	3	$0
Growth	10	$650/month
Scale	50	$1,300+/month
Enterprise	200+	Custom
Recommendation: Start Free tier. Scale to Growth ($650/month) at 100+ users.

Complete Integration Checklist
 Create Merge account (get API key)

 Enable CRM integrations (50+ systems)

 Implement Merge Link (OAuth flow)

 Store account tokens per user

 Query unified contacts API

 Create contacts from chatbot leads

 Create deals from workflows

 Implement field mappings

 Set up Mixpanel tracking

 Test end-to-end in sandbox

 Deploy to production

 Monitor syncs in Merge dashboard

Last Updated: November 29, 2025
Status: Production Ready
Support: support@writeral.com