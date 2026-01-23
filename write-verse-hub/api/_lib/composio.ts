import type { Composio } from '@composio/core';

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || '';

let composioClient: Composio | null = null;

type RawComposioTool = any;

const rawToolsCache = new Map<string, RawComposioTool[]>();

function titleCase(s: string) {
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

const AUTH_CONFIG_IDS: Record<string, string> = {
  gmail: 'ac_qBcz-RYPTACX',
  google_tasks: 'ac_P16-Afw5YdzC',
  googletasks: 'ac_P16-Afw5YdzC',
  bitbucket: 'ac_AX7k0ab-0bJK',
  airtable: 'ac_Cc1riuNOBOr5',
  youtube: 'ac_EB9GDAd-1laT',
  instagram: 'ac_ouoKtbuh_1K2',
  google_meet: 'ac_7c6i5vJuCKYd',
  googlemeet: 'ac_7c6i5vJuCKYd',
  whatsapp: 'ac_E3ysdgIiSV-1',
  facebook: 'ac_HgkGYTpNYq66',
  twitter: 'ac_l6PnNslXVStt',
  outlook: 'ac_SIS0eQ7q3XKn',
  supabase: 'ac_EffWn5SRC0rt',
  slack: 'ac_d5o_e2mvkL38',
  google_sheets: 'ac_V6RiqxgjO2VB',
  googlesheets: 'ac_V6RiqxgjO2VB',
  google_calendar: 'ac_MOCj51qN9yJh',
  googlecalendar: 'ac_MOCj51qN9yJh',
  github: 'ac_8E4Wt8bTlhl1',
  google_drive: 'ac_KBgJEaJI2nEo',
  googledrive: 'ac_KBgJEaJI2nEo',
  google_docs: 'ac_gsKCnvXmli3T',
  googledocs: 'ac_gsKCnvXmli3T',
  linear: 'ac_-H6eQJCVCsYV',
  discord: 'ac_eEjediUwu5nx',
  figma: 'ac_UIaRfQEkkNES',
  reddit: 'ac_fpFuKsaQg6Nd',
  wrike: 'ac_YGOnq5dBZrCO',
  microsoft_teams: 'ac_XrZFcnZKXi4m',
  asana: 'ac_zA23i38d5CDs',
  linkedin: 'ac_WEem-TDnD-7R',
  google_maps: 'ac_4QG8OTIF5DmQ',
  hubspot: 'ac_7aK5vrpXII8p',
  one_drive: 'ac_n6MNsAkoQDbI',
  salesforce: 'ac_yfV3bj6Hvdaz',
  pipedrive: 'ac_0i14GD9BWczp',
};

async function getClient() {
  if (!COMPOSIO_API_KEY) return null;
  if (composioClient) return composioClient;

  const mod = await import('@composio/core');
  composioClient = new mod.Composio({ apiKey: COMPOSIO_API_KEY }) as any;
  return composioClient;
}

export async function getRawToolsForApp(appSlug: string): Promise<RawComposioTool[]> {
  const client = await getClient();
  if (!client) return [];

  const cacheKey = normalizeAppName(appSlug);
  if (!cacheKey) return [];
  if (rawToolsCache.has(cacheKey)) return rawToolsCache.get(cacheKey) || [];

  const tools = await (client as any).tools.getRawComposioTools({ toolkits: [cacheKey] });
  const list = Array.isArray(tools) ? tools : [];
  rawToolsCache.set(cacheKey, list);
  return list;
}

function getToolName(t: any): string {
  return String(t?.slug || t?.name || t?.function?.name || '').trim();
}

export function pickBestToolForQuery(rawTools: RawComposioTool[], query: string): RawComposioTool | null {
  const q = String(query || '').toLowerCase();
  const scored = rawTools
    .map((t) => {
      const name = getToolName(t).toLowerCase();
      let score = 0;

      if (!name) return { t, score: -999 };

      if (q.includes('email') || q.includes('emails') || q.includes('gmail')) {
        if (name.includes('message') || name.includes('mail') || name.includes('email')) score += 3;
        if (name.includes('list')) score += 3;
        if (name.includes('search')) score += 2;
        if (name.includes('get')) score += 1;
        if (name.includes('thread')) score += 1;
        if (name.includes('send')) score -= 2;
        if (name.includes('draft')) score -= 2;
      }

      // Prefer simpler tools with fewer required params
      const required =
        t?.inputSchema?.required || t?.function?.parameters?.required || t?.parameters?.required || [];
      if (Array.isArray(required)) score += Math.max(0, 3 - required.length);

      return { t, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.t || null;
}

export function buildParamsFromSchema(tool: RawComposioTool, userQuery: string) {
  const tryParseJsonObject = (v: any) => {
    try {
      if (typeof v !== 'string') return null;
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object') return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const schemaCandidates = [
    tool?.inputSchema,
    tool?.input_schema,
    tool?.schema,
    tool?.parametersSchema,
    tool?.parameters_schema,
    tool?.function?.parameters,
    tool?.parameters,
    tryParseJsonObject(tool?.inputSchema),
    tryParseJsonObject(tool?.input_schema),
    tryParseJsonObject(tool?.schema),
    tryParseJsonObject(tool?.function?.parameters),
    tryParseJsonObject(tool?.parameters),
  ].filter(Boolean);

  const schema = (schemaCandidates.find((s: any) => s?.properties || s?.required) as any) || {};
  const props = schema?.properties || {};
  const required: string[] = schema?.required || [];

  const params: any = {};

  const setIfExists = (keys: string[], value: any) => {
    for (const k of keys) {
      if (props && Object.prototype.hasOwnProperty.call(props, k)) {
        params[k] = value;
        return true;
      }
    }
    return false;
  };

  // Common knobs
  setIfExists(['maxResults', 'max_results', 'limit', 'max', 'count', 'pageSize', 'page_size'], 5);
  setIfExists(['includeSpamTrash', 'include_spam_trash'], false);

  // Query-like
  const baseQuery = 'in:inbox newer_than:7d';
  setIfExists(['query', 'q', 'search', 'searchQuery', 'search_query'], baseQuery);

  // Some tools require labelIds
  setIfExists(['labelIds', 'label_ids'], ['INBOX']);

  // If schema requires a "userId" (Gmail API userId), 'me' is typical.
  setIfExists(['userId', 'user_id'], 'me');

  // Best-effort: satisfy required fields if we can infer
  for (const k of required) {
    if (params[k] !== undefined) continue;
    if (k.toLowerCase().includes('query')) {
      params[k] = baseQuery;
      continue;
    }
    if (k.toLowerCase().includes('userid')) {
      params[k] = 'me';
      continue;
    }
    if (k.toLowerCase().includes('max') || k.toLowerCase().includes('limit') || k.toLowerCase().includes('count')) {
      params[k] = 5;
      continue;
    }
  }

  const isGmailTool = getToolName(tool).toLowerCase().includes('gmail');
  const hasAnyParam = Object.keys(params).length > 0;

  if (!hasAnyParam && isGmailTool) {
    const fallback: any = {
      userId: 'me',
      q: 'in:inbox newer_than:7d',
      query: 'in:inbox newer_than:7d',
      maxResults: 5,
      limit: 5,
      pageSize: 5,
      labelIds: ['INBOX'],
    };

    for (const [k, v] of Object.entries(fallback)) {
      if (props && Object.prototype.hasOwnProperty.call(props, k)) {
        params[k] = v;
      }
    }
  }

  return params;
}

export async function executeTool(
  userId: string,
  appSlug: string,
  tool: RawComposioTool,
  params: any,
  connectionId: string
) {
  const client = await getClient();
  if (!client) {
    return { success: false, error: 'Composio not configured' };
  }

  const appName = normalizeAppName(appSlug);
  if (!appName) return { success: false, error: 'Missing app' };
  if (!connectionId) return { success: false, error: 'Missing connectionId' };

  const version = tool?.version;
  const result = await (client as any).tools.executeComposioTool(tool, {
    arguments: params || {},
    userId,
    version,
    connectedAccountId: connectionId,
    appName,
  });

  return { success: true, result };
}

export async function findConnectionIdForApp(userId: string, appSlug: string): Promise<string | null> {
  const { success, accounts } = await getConnectedAccounts(userId);
  if (!success) return null;

  const target = normalizeAppName(appSlug);
  const list = Array.isArray(accounts) ? accounts : [];

  const normalized = list
    .map((acc: any) => {
      const slug = String(acc?.toolkit?.slug || acc?.toolkitSlug || acc?.appSlug || acc?.app || acc?.appName || '')
        .trim()
        .toLowerCase();
      const status = String(acc?.status || acc?.state || '').toUpperCase();
      const id = String(
        acc?.connectedAccountId ||
          acc?.connected_account_id ||
          acc?.connectionId ||
          acc?.id ||
          ''
      ).trim();

      return { acc, slug, status, id };
    })
    .filter((x) => x.slug);

  const candidates = normalized.filter((x) => x.slug === target || x.slug.includes(target) || target.includes(x.slug));
  if (candidates.length === 0) return null;

  const active = candidates.find((x) => x.status === 'ACTIVE' || x.status === 'CONNECTED');
  const chosen = active || candidates[0];
  return chosen.id || null;
}

export async function healthCheck() {
  if (!COMPOSIO_API_KEY) {
    return { status: 'disabled', reason: 'COMPOSIO_API_KEY not set', enabled: false };
  }

  try {
    const client = await getClient();
    if (!client) {
      return { status: 'error', reason: 'Failed to initialize client', enabled: true };
    }

    await (client as any).tools.get('default', { toolkits: ['hackernews'] });
    return { status: 'healthy', enabled: true };
  } catch (e: any) {
    return { status: 'error', reason: String(e?.message || e), enabled: true };
  }
}

export async function getAvailableApps() {
  const enabled = !!COMPOSIO_API_KEY;
  if (!enabled) {
    return { success: false, apps: [], error: 'Composio not configured' };
  }

  const apps = Object.keys(AUTH_CONFIG_IDS)
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({
      name: slug.toUpperCase(),
      displayName: titleCase(slug),
    }));

  return { success: true, apps };
}

function normalizeAppName(appName: string) {
  return String(appName || '').trim().toLowerCase();
}

export async function getConnectedAccounts(userId: string) {
  const client = await getClient();
  if (!client) {
    return { success: false, accounts: [], error: 'Composio not configured' };
  }

  const connections = await (client as any).connectedAccounts.list({ entityId: userId });

  // SDK response may be an array or an object like { items: [...] }
  const accounts =
    (Array.isArray(connections) && connections) ||
    (Array.isArray((connections as any)?.items) && (connections as any).items) ||
    [];

  return { success: true, accounts };
}

export async function initiateConnection(userId: string, appName: string, redirectUrl: string) {
  const client = await getClient();
  if (!client) {
    return { success: false, error: 'Composio not configured' };
  }

  const key = normalizeAppName(appName);
  const authConfigId = AUTH_CONFIG_IDS[key];

  if (!authConfigId) {
    return {
      success: false,
      error: `${appName} is not configured yet. Auth config needs to be created in Composio Dashboard.`,
      setupRequired: true,
    };
  }

  const connectionRequest = await (client as any).connectedAccounts.initiate(userId, authConfigId, {
    callbackUrl: redirectUrl,
    allowMultiple: true,
  });

  const authUrl =
    connectionRequest?.redirectUrl ||
    connectionRequest?.url ||
    connectionRequest?.authUrl ||
    connectionRequest?.connectionUrl;

  if (!authUrl) {
    return {
      success: false,
      error: 'App requires setup in Composio Dashboard. Please configure the auth config first.',
      setupRequired: true,
    };
  }

  return {
    success: true,
    authUrl,
    connectionId: connectionRequest?.connectedAccountId || connectionRequest?.id || null,
  };
}

export async function disconnectConnection(userId: string, connectionId: string) {
  const client = await getClient();
  if (!client) {
    return { success: false, error: 'Composio not configured' };
  }

  await (client as any).connectedAccounts.delete(connectionId);
  return { success: true };
}
