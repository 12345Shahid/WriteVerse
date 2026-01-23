import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Check, 
  Link as LinkIcon, 
  Loader2, 
  RefreshCw, 
  Unlink, 
  AlertCircle,
  ExternalLink,
  Plug
} from 'lucide-react';

interface AgentIntegrationsProps {
  agentId: string;
}

interface ComposioApp {
  name: string;
  displayName?: string;
  description?: string;
  logo?: string;
  categories?: string[];
}

interface ConnectedAccount {
  id: string;
  appName: string;
  status: string;
  connectedAt?: string;
}

// Popular apps to show first
const POPULAR_APPS = [
  'SLACK', 'GMAIL', 'NOTION', 'GOOGLE_SHEETS', 'HUBSPOT', 
  'SALESFORCE', 'AIRTABLE', 'ASANA', 'TRELLO', 'DISCORD'
];

export function AgentIntegrations({ agentId }: AgentIntegrationsProps) {
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [composioEnabled, setComposioEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableApps, setAvailableApps] = useState<ComposioApp[]>([]);
  const [connectedApps, setConnectedApps] = useState<ConnectedAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadIntegrations();
  }, [agentId]);

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get session for user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to manage integrations');
        setLoading(false);
        return;
      }

      // Check Composio health
      const healthRes = await fetch('/api/composio/health');
      const health = await healthRes.json();
      
      if (health.status === 'disabled') {
        setComposioEnabled(false);
        setError('Integrations are not configured. Add COMPOSIO_API_KEY to enable.');
        setLoading(false);
        return;
      }

      if (health.status === 'error') {
        setError(`Integration service error: ${health.reason}`);
        setLoading(false);
        return;
      }

      setComposioEnabled(true);

      // Fetch available apps
      const appsRes = await fetch('/api/composio/apps');
      const appsData = await appsRes.json();
      
      if (appsData.apps) {
        // Sort popular apps first
        const sorted = appsData.apps.sort((a: ComposioApp, b: ComposioApp) => {
          const aPopular = POPULAR_APPS.indexOf(a.name);
          const bPopular = POPULAR_APPS.indexOf(b.name);
          if (aPopular >= 0 && bPopular >= 0) return aPopular - bPopular;
          if (aPopular >= 0) return -1;
          if (bPopular >= 0) return 1;
          return a.name.localeCompare(b.name);
        });
        setAvailableApps(sorted);
      }

      // Fetch connected accounts for this user
      const connectionsRes = await fetch('/api/composio/connections', {
        headers: {
          'x-user-id': session.user.id
        }
      });
      const connectionsData = await connectionsRes.json();
      
      // Handle nested structure: accounts.items or accounts array
      const rawAccounts = connectionsData.accounts?.items || 
                          (Array.isArray(connectionsData.accounts) ? connectionsData.accounts : []);
      
      console.log('[AgentIntegrations] Raw accounts:', rawAccounts);
      
      if (rawAccounts.length > 0) {
        setConnectedApps(rawAccounts.map((acc: any) => ({
          id: acc.id || acc.connectionId || acc.connectedAccountId || '',
          appName: acc.toolkit?.slug?.toUpperCase() || acc.appName || acc.app || acc.integrationId || 'Unknown',
          status: acc.status || 'ACTIVE',
          connectedAt: acc.createdAt || acc.connectedAt
        })));
      }

      // Also fetch agent-specific integrations from our DB
      const { data: agentIntegrations } = await supabase
        .from('agent_integrations')
        .select('*')
        .eq('agent_id', agentId);

      // Merge with connected accounts
      if (agentIntegrations) {
        // Will be used to show which apps are linked to this agent
      }

    } catch (err: any) {
      console.error('[AgentIntegrations] Load error:', err);
      setError(err.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (appName: string) => {
    setConnecting(appName);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Please log in', variant: 'destructive' });
        return;
      }

      const res = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
          'x-organization-id': currentTeam?.id || ''
        },
        body: JSON.stringify({
          appName,
          agentId,  // Link this connection to the agent
          redirectUrl: `${window.location.origin}/agents/${agentId}/integrations/callback`
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Connection failed');
      }

      if (data.authUrl) {
        // Open OAuth window
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        toast({ 
          title: 'Complete authorization', 
          description: 'Please complete the authorization in the popup window' 
        });
      }

    } catch (err: any) {
      console.error('[AgentIntegrations] Connect error:', err);
      toast({ 
        title: 'Connection failed', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (account: ConnectedAccount) => {
    setConnecting(account.appName);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/composio/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id
        },
        body: JSON.stringify({ connectionId: account.id })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Disconnect failed');
      }

      setConnectedApps(prev => prev.filter(a => a.id !== account.id));
      toast({ title: 'Disconnected', description: `${account.appName} has been disconnected` });

    } catch (err: any) {
      toast({ 
        title: 'Disconnect failed', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setConnecting(null);
    }
  };

  const isConnected = (appName: string) => {
    return connectedApps.some(a => 
      a.appName.toUpperCase() === appName.toUpperCase() && 
      (a.status === 'connected' || a.status === 'ACTIVE')
    );
  };

  const getConnectedAccount = (appName: string) => {
    return connectedApps.find(a => 
      a.appName.toUpperCase() === appName.toUpperCase()
    );
  };

  // Filter apps by search
  const filteredApps = searchQuery 
    ? availableApps.filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : availableApps.slice(0, 8); // Show first 8 by default

  if (!composioEnabled && !loading) {
    return (
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Plug className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-bold mb-2">Integrations Coming Soon</h3>
          <p className="text-muted-foreground max-w-md">
            Connect your agent to 500+ apps like Slack, Gmail, HubSpot, and more.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Agent Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Connect apps so your agent can take actions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadIntegrations} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-2 border-orange-500 bg-orange-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <span className="text-orange-700">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card className="border-2 border-gray-200">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading integrations...</span>
          </CardContent>
        </Card>
      )}

      {/* Connected Apps */}
      {!loading && connectedApps.length > 0 && (
        <Card className="border-2 border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700 text-base">
              Connected ({connectedApps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {connectedApps.map(account => (
                <div 
                  key={account.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-green-500 rounded-lg"
                >
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{account.appName}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 px-2 text-red-600 hover:text-red-700"
                    onClick={() => handleDisconnect(account)}
                    disabled={connecting === account.appName}
                  >
                    {connecting === account.appName ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Apps */}
      {!loading && composioEnabled && (
        <Card className="border-2 border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="text-base">Available Apps</CardTitle>
                <input
                    type="text"
                    placeholder="Search integrations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm w-full max-w-xs"
                />
            </div>
          </CardHeader>
          <CardContent>
            {filteredApps.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No results found.
              </div>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredApps.map(app => {
                const connected = isConnected(app.name);
                const isLoading = connecting === app.name;
                
                return (
                  <div
                    key={app.name}
                    className={`
                      p-3 border-2 rounded-lg text-center transition-all cursor-pointer
                      ${connected 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-black hover:shadow-sm'
                      }
                      ${isLoading ? 'opacity-60 pointer-events-none' : ''}
                    `}
                    onClick={() => !connected && handleConnect(app.name)}
                  >
                    {connected && (
                      <Check className="h-4 w-4 text-green-600 absolute top-1 right-1" />
                    )}
                    <p className="font-bold text-sm truncate">
                      {app.displayName || app.name.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-2">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : connected ? (
                        <span className="text-xs text-green-600">Connected</span>
                      ) : (
                        <span className="text-xs text-blue-600 flex items-center justify-center gap-1">
                          <LinkIcon className="h-3 w-3" /> Connect
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
            
            {availableApps.length > 8 && !searchQuery && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Showing top 8 of {availableApps.length} apps. Search to find more.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
