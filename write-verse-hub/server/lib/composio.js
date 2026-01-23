/**
 * Composio Integration Service
 * 
 * Provides managed OAuth and tool execution for 500+ apps.
 * Used by: Custom Agents, Specialized Tools, Workflows
 * 
 * All operations are logged with [Composio][ACTION] format for easy debugging.
 * 
 * @see https://docs.composio.dev - Composio SDK Documentation
 */
import 'dotenv/config';

// Feature flag - gracefully disabled if not configured
const COMPOSIO_ENABLED = !!process.env.COMPOSIO_API_KEY;

// Lazy-loaded Composio client
let composioClient = null;

/**
 * Initialize Composio client (singleton)
 */
async function getClient() {
  if (!COMPOSIO_ENABLED) {
    console.log('[Composio][INIT] Disabled - COMPOSIO_API_KEY not set');
    return null;
  }

  if (composioClient) {
    return composioClient;
  }

  try {
    const { Composio } = await import('@composio/core');
    composioClient = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY
    });
    console.log('[Composio][INIT] Client initialized successfully');
    return composioClient;
  } catch (error) {
    console.error('[Composio][INIT][ERROR] Failed to initialize:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return null;
  }
}

/**
 * Check if Composio is available and configured
 */
export function isComposioEnabled() {
  return COMPOSIO_ENABLED;
}

/**
 * Auth Config IDs from Composio Dashboard
 * Each app needs its own auth config created in Composio Dashboard
 * Add new configs here as they are created
 */
const AUTH_CONFIG_IDS = {
  'gmail': 'ac_qBcz-RYPTACX',
  'googletasks': 'ac_P16-Afw5YdzC',
  'bitbucket': 'ac_AX7k0ab-0bJK',
  'airtable': 'ac_Cc1riuNOBOr5',
  'youtube': 'ac_EB9GDAd-1laT',
  'instagram': 'ac_ouoKtbuh_1K2',
  'googlemeet': 'ac_7c6i5vJuCKYd',
  'whatsapp': 'ac_E3ysdgIiSV-1',
  'facebook': 'ac_HgkGYTpNYq66',
  'twitter': 'ac_l6PnNslXVStt',
  'outlook': 'ac_SIS0eQ7q3XKn',
  'supabase': 'ac_EffWn5SRC0rt',
  'slack': 'ac_d5o_e2mvkL38',
  'googlesheets': 'ac_V6RiqxgjO2VB',
  'googlecalendar': 'ac_MOCj51qN9yJh',
  'github': 'ac_8E4Wt8bTlhl1',
  'googledrive': 'ac_KBgJEaJI2nEo',
  'googledocs': 'ac_gsKCnvXmli3T',
  'linear': 'ac_-H6eQJCVCsYV',
  'discord': 'ac_eEjediUwu5nx',
  'figma': 'ac_UIaRfQEkkNES',
  'reddit': 'ac_fpFuKsaQg6Nd',
  'wrike': 'ac_YGOnq5dBZrCO',
  'microsoft_teams': 'ac_XrZFcnZKXi4m',
  'asana': 'ac_zA23i38d5CDs',
  'linkedin': 'ac_WEem-TDnD-7R',
  'google_maps': 'ac_4QG8OTIF5DmQ',
  'hubspot': 'ac_7aK5vrpXII8p',
  'one_drive': 'ac_n6MNsAkoQDbI',
  'salesforce': 'ac_yfV3bj6Hvdaz',
  'pipedrive': 'ac_0i14GD9BWczp',
};

/**
 * Get available toolkits from Composio
 * Since the SDK doesn't have a list-all endpoint, we return popular ones
 * @returns Array of available toolkits
 */
export async function getAvailableApps() {
  const client = await getClient();
  if (!client) {
    console.log('[Composio][APPS] Skipped - client not available');
    return { success: false, apps: [], error: 'Composio not configured' };
  }

  // Return curated list of popular integrations supported by Composio
  const popularApps = [
    { name: 'SLACK', displayName: 'Slack', description: 'Team messaging' },
    { name: 'GMAIL', displayName: 'Gmail', description: 'Send and read emails' },
    { name: 'NOTION', displayName: 'Notion', description: 'Docs and databases' },
    { name: 'GOOGLE_SHEETS', displayName: 'Google Sheets', description: 'Spreadsheets' },
    { name: 'GOOGLE_CALENDAR', displayName: 'Google Calendar', description: 'Calendar events' },
    { name: 'GOOGLE_DRIVE', displayName: 'Google Drive', description: 'File storage' },
    { name: 'HUBSPOT', displayName: 'HubSpot', description: 'CRM and marketing' },
    { name: 'AIRTABLE', displayName: 'Airtable', description: 'Database and spreadsheet' },
    { name: 'ASANA', displayName: 'Asana', description: 'Project management' },
    { name: 'TRELLO', displayName: 'Trello', description: 'Kanban boards' },
    { name: 'DISCORD', displayName: 'Discord', description: 'Community chat' },
    { name: 'GITHUB', displayName: 'GitHub', description: 'Code repository' },
    { name: 'JIRA', displayName: 'Jira', description: 'Issue tracking' },
    { name: 'LINEAR', displayName: 'Linear', description: 'Issue tracking' },
    { name: 'SALESFORCE', displayName: 'Salesforce', description: 'CRM' },
    { name: 'ZENDESK', displayName: 'Zendesk', description: 'Customer support' },
    { name: 'INTERCOM', displayName: 'Intercom', description: 'Customer messaging' },
    { name: 'MAILCHIMP', displayName: 'Mailchimp', description: 'Email marketing' },
    { name: 'TWITTER', displayName: 'Twitter/X', description: 'Social media' },
    { name: 'LINKEDIN', displayName: 'LinkedIn', description: 'Professional network' },
  ];

  console.log('[Composio][APPS] Returning', popularApps.length, 'popular apps');
  return { success: true, apps: popularApps };
}

/**
 * Get tools for a specific toolkit
 * @param appName - Toolkit identifier (e.g., 'GMAIL', 'SLACK')
 */
export async function getAppTools(appName) {
  const client = await getClient();
  if (!client) {
    return { success: false, tools: [], error: 'Composio not configured' };
  }

  try {
    console.log('[Composio][TOOLS] Fetching tools for:', appName);
    // Use the new SDK API to get tools
    const tools = await client.tools.get('default', { toolkits: [appName.toLowerCase()] });
    console.log('[Composio][TOOLS] Found', tools?.length || 0, 'tools for', appName);
    return { success: true, tools: tools || [] };
  } catch (error) {
    console.error('[Composio][TOOLS][ERROR]', {
      app: appName,
      error: error.message
    });
    return { success: false, tools: [], error: error.message };
  }
}

/**
 * Get tools for multiple toolkits (for agent with multiple connections)
 * @param appNames - Array of toolkit identifiers
 */
export async function getToolsForApps(appNames) {
  const client = await getClient();
  if (!client || !appNames?.length) {
    return { success: false, tools: [] };
  }

  try {
    console.log('[Composio][TOOLS] Fetching tools for toolkits:', appNames.join(', '));
    // Convert to lowercase for SDK compatibility
    const toolkits = appNames.map(a => a.toLowerCase());
    const tools = await client.tools.get('default', { toolkits });
    console.log('[Composio][TOOLS] Total tools found:', tools?.length || 0);
    return { success: true, tools: tools || [] };
  } catch (error) {
    console.error('[Composio][TOOLS][ERROR]', {
      apps: appNames,
      error: error.message
    });
    return { success: false, tools: [], error: error.message };
  }
}

/**
 * Initiate OAuth connection for a user to a toolkit
 * 
 * NOTE: Composio requires an authConfigId for each app integration.
 * These must be set up in the Composio dashboard first.
 * 
 * @param userId - WriterAI user ID (used as entityId)
 * @param appName - Toolkit to connect (e.g., 'SLACK')
 * @param redirectUrl - Where to redirect after OAuth
 */
export async function initiateConnection(userId, appName, redirectUrl) {
  const client = await getClient();
  if (!client) {
    return { success: false, error: 'Composio not configured' };
  }

  try {
    console.log('[Composio][CONNECT] Initiating connection:', {
      userId: userId?.substring(0, 8) + '...',
      app: appName
    });

    // Get auth config ID from our mapping
    const authConfigId = AUTH_CONFIG_IDS[appName.toLowerCase()];
    
    if (!authConfigId) {
      console.warn('[Composio][CONNECT] No auth config for:', appName);
      return { 
        success: false, 
        error: `${appName} is not configured yet. Auth config needs to be created in Composio Dashboard.`,
        setupRequired: true
      };
    }

    console.log('[Composio][CONNECT] Using auth config:', authConfigId);
    
    // Use the SDK's initiate method with the auth config ID
    const connectionRequest = await client.connectedAccounts.initiate(
      userId,  // entityId
      authConfigId,  // authConfigId from Composio Dashboard
      {
        callbackUrl: redirectUrl || `${process.env.APP_URL || 'http://localhost:8080'}/settings/integrations/callback`,
        allowMultiple: true  // Allow multiple accounts per app
      }
    );

    console.log('[Composio][CONNECT] Connection request:', connectionRequest);
    
    // The connection request returns a URL for OAuth
    const authUrl = connectionRequest?.redirectUrl || 
                    connectionRequest?.url || 
                    connectionRequest?.authUrl ||
                    connectionRequest?.connectionUrl;
    
    if (!authUrl) {
      console.error('[Composio][CONNECT] No auth URL returned:', connectionRequest);
      return { 
        success: false, 
        error: 'App requires setup in Composio Dashboard. Please configure the auth config first.',
        setupRequired: true
      };
    }

    return { 
      success: true, 
      authUrl: authUrl,
      connectionId: connectionRequest?.connectedAccountId || connectionRequest?.id
    };
  } catch (error) {
    console.error('[Composio][CONNECT][ERROR]', {
      userId: userId?.substring(0, 8) + '...',
      app: appName,
      error: error.message,
      code: error.code
    });
    
    // Handle error about multiple accounts - already connected
    if (error.message?.includes('Multiple connected accounts')) {
      return { 
        success: false, 
        error: `Already connected to ${appName}. Use the accounts list to manage connections.`,
        alreadyConnected: true
      };
    }
    
    // Provide helpful error message
    if (error.message?.includes('authConfig')) {
      return { 
        success: false, 
        error: `${appName} requires setup in Composio Dashboard. Please create an auth config first.`,
        setupRequired: true
      };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Get user's connected accounts
 * @param userId - WriterAI user ID
 */
export async function getConnectedAccounts(userId) {
  const client = await getClient();
  if (!client) {
    return { success: false, accounts: [] };
  }

  try {
    console.log('[Composio][ACCOUNTS] Fetching for user:', userId?.substring(0, 8) + '...');
    const connections = await client.connectedAccounts.list({
      entityId: userId
    });
    
    console.log('[Composio][ACCOUNTS] Found', connections?.length || 0, 'connections');
    return { 
      success: true, 
      accounts: connections || [] 
    };
  } catch (error) {
    console.error('[Composio][ACCOUNTS][ERROR]', {
      userId: userId?.substring(0, 8) + '...',
      error: error.message
    });
    return { success: false, accounts: [], error: error.message };
  }
}

/**
 * Disconnect a toolkit for a user
 * @param userId - WriterAI user ID
 * @param connectionId - Composio connection ID
 */
export async function disconnectApp(userId, connectionId) {
  const client = await getClient();
  if (!client) {
    return { success: false, error: 'Composio not configured' };
  }

  try {
    console.log('[Composio][DISCONNECT] Removing connection:', {
      userId: userId?.substring(0, 8) + '...',
      connectionId: connectionId?.substring(0, 8) + '...'
    });

    await client.connectedAccounts.delete(connectionId);
    
    console.log('[Composio][DISCONNECT] Success');
    return { success: true };
  } catch (error) {
    console.error('[Composio][DISCONNECT][ERROR]', {
      connectionId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Execute a tool action
 * @param userId - WriterAI user ID (entityId)
 * @param toolName - Tool to execute (e.g., 'SLACK_SEND_MESSAGE')
 * @param params - Tool parameters
 * @param meta - Additional metadata for logging
 */
// Cache for raw tools to avoid re-fetching on every execution
const rawToolsCache = new Map();

/**
 * Get raw tools for an app (cached)
 */
async function getRawToolsForApp(appName) {
  if (!appName) return [];
  const cacheKey = appName.toLowerCase();
  
  if (rawToolsCache.has(cacheKey)) {
    return rawToolsCache.get(cacheKey);
  }

  const client = await getClient();
  if (!client) return [];

  try {
    // console.log('[Composio][TOOLS] Fetching RAW tools for:', cacheKey);
    const tools = await client.tools.getRawComposioTools({ toolkits: [cacheKey] });
    if (tools && tools.length > 0) {
      rawToolsCache.set(cacheKey, tools);
      return tools;
    }
  } catch (error) {
    console.error(`[Composio][TOOLS] Failed to fetch raw tools for ${appName}:`, error.message);
  }
  return [];
}

/**
 * Execute a tool action
 * @param userId - WriterAI user ID (entityId)
 * @param toolName - Tool to execute (e.g., 'SLACK_SEND_MESSAGE')
 * @param params - Tool parameters
 * @param meta - Additional metadata: { connectionId, appName }
 */
export async function executeTool(userId, toolName, params, meta = {}) {
  const startTime = Date.now();
  const client = await getClient();
  
  if (!client) {
    return { 
      success: false, 
      error: 'Composio not configured',
      executionTime: 0
    };
  }

  try {
    console.log('[Composio][EXECUTE] Starting tool execution:', {
      userId: userId?.substring(0, 8) + '...',
      tool: toolName,
      paramsKeys: Object.keys(params || {}),
      ...meta
    });

    // 1. Determine App Name if not provided
    let appName = meta.appName;
    if (!appName && toolName.includes('_')) {
      appName = toolName.split('_')[0].toLowerCase();
    }

    if (!appName) {
        throw new Error(`Could not determine app name for tool ${toolName}`);
    }

    // 2. Fetch Raw Tools to get Version and Object
    const rawTools = await getRawToolsForApp(appName);
    const rawTool = rawTools.find(t => t.slug === toolName || t.name === toolName || (t.slug && t.slug.includes(toolName)));

    if (!rawTool) {
       throw new Error(`Tool ${toolName} not found in app ${appName}`);
    }

    // 3. Execute using executeComposioTool with required metadata
    // Note: connectedAccountId in body must be camelCase as per SDK internal logic
    const result = await client.tools.executeComposioTool(rawTool, {
      arguments: params,
      userId: userId,
      version: rawTool.version,
      connectedAccountId: meta.connectionId,
      appName: appName // generic metadata
    });

    const executionTime = Date.now() - startTime;
    
    console.log('[Composio][EXECUTE] Success:', {
      tool: toolName,
      executionTime: executionTime + 'ms',
      resultKeys: Object.keys(result || {})
    });

    return {
      success: true,
      result: result,
      executionTime: executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('[Composio][EXECUTE][ERROR]', {
      userId: userId?.substring(0, 8) + '...',
      tool: toolName,
      error: error.message,
      // code: error.code,
      executionTime: executionTime + 'ms'
    });

    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      executionTime: executionTime
    };
  }
}

/**
 * Format tools for Gemini function calling
 * Converts Composio tool format to Gemini-compatible format
 */
export function formatToolsForGemini(composioTools) {
  if (!composioTools?.length) return [];

  return composioTools.map(tool => ({
    name: tool.function?.name || tool.name,
    description: tool.function?.description || tool.description || `Execute ${tool.name}`,
    parameters: tool.function?.parameters || {
      type: 'object',
      properties: tool.inputSchema?.properties || {},
      required: tool.inputSchema?.required || []
    }
  }));
}

/**
 * Get tools formatted for Gemini for a specific user
 * Used by agent engine to enable function calling
 */
export async function getToolsForAgent(userId, connectedApps) {
  if (!connectedApps?.length) {
    console.log('[Composio][AGENT] No connected apps for user');
    return [];
  }

  const { success, tools } = await getToolsForApps(connectedApps);
  if (!success || !tools.length) {
    return [];
  }

  const geminiTools = formatToolsForGemini(tools);
  console.log('[Composio][AGENT] Prepared', geminiTools.length, 'tools for Gemini');
  return geminiTools;
}

// Export diagnostic function for health checks
export async function healthCheck() {
  if (!COMPOSIO_ENABLED) {
    return { 
      status: 'disabled', 
      reason: 'COMPOSIO_API_KEY not set',
      enabled: false
    };
  }

  const client = await getClient();
  if (!client) {
    return { 
      status: 'error', 
      reason: 'Failed to initialize client',
      enabled: true
    };
  }

  try {
    // Test the SDK is working by checking if tools can be accessed
    // Using a simple check instead of listing all toolkits
    const testTools = await client.tools.get('default', { toolkits: ['hackernews'] });
    return { 
      status: 'healthy', 
      enabled: true,
      toolsAvailable: testTools?.length > 0
    };
  } catch (error) {
    return { 
      status: 'error', 
      reason: error.message,
      enabled: true
    };
  }
}
