import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button-brutal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, ExternalLink } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";

// Supported CRMs with their metadata
const CRM_LIST = [
    { 
        id: 'hubspot', 
        name: 'HubSpot', 
        description: 'Popular CRM for sales & marketing',
        logo: 'https://cdn.brandfetch.io/id6_GQwBYi/theme/dark/symbol.svg?k=id64Mup7ac',
        color: '#FF7A59'
    },
    { 
        id: 'salesforce', 
        name: 'Salesforce', 
        description: 'Enterprise CRM platform',
        logo: 'https://cdn.brandfetch.io/id20mQyGeY/theme/dark/symbol.svg?k=id64Mup7ac',
        color: '#00A1E0'
    },
    { 
        id: 'pipedrive', 
        name: 'Pipedrive', 
        description: 'Sales-focused CRM',
        logo: 'https://cdn.brandfetch.io/idSWu9DRNW/theme/dark/symbol.svg?k=id64Mup7ac',
        color: '#25292C'
    }
];

interface CRMConnection {
    appName: string;
    connectionId: string;
    connectionStatus: string;
}

export function AgentCRMConnector({ agentId, isViewer = false }: { agentId: string; isViewer?: boolean }) {
    const [connections, setConnections] = useState<CRMConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<string | null>(null);

    useEffect(() => {
        if (agentId) fetchConnections();
    }, [agentId]);

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            
            // Fetch agent integrations from database
            const { data, error } = await supabase
                .from('agent_integrations')
                .select('app_name, connection_id, connection_status')
                .eq('agent_id', agentId);
            
            if (error) throw error;
            
            const mapped = (data || []).map(d => ({
                appName: d.app_name,
                connectionId: d.connection_id,
                connectionStatus: d.connection_status
            }));
            
            setConnections(mapped);
            console.log('[CRM] Agent connections:', mapped);
        } catch (e) {
            console.error('[CRM] Failed to fetch connections:', e);
        } finally {
            setLoading(false);
        }
    };

    const connectCRM = async (crmId: string) => {
        setConnecting(crmId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            console.log(`[CRM] Initiating ${crmId} connection for agent ${agentId}`);
            
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/composio/connect`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'X-User-Id': session.user.id
                },
                body: JSON.stringify({
                    appName: crmId.toUpperCase(),
                    agentId: agentId,
                    redirectUrl: `${window.location.origin}/settings/embed?connected=${crmId}`
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                if (data.setupRequired) {
                    toast.error(`${crmId} is not configured yet. Please set up the auth config in Composio Dashboard.`);
                } else {
                    throw new Error(data.error || 'Connection failed');
                }
                return;
            }

            if (data.authUrl) {
                // Redirect to OAuth
                console.log(`[CRM] Redirecting to OAuth: ${data.authUrl}`);
                window.location.href = data.authUrl;
            } else {
                toast.success(`${crmId} connected!`);
                fetchConnections();
            }
        } catch (e: any) {
            console.error(`[CRM] Connection error:`, e);
            toast.error(e.message || 'Failed to connect');
        } finally {
            setConnecting(null);
        }
    };

    const disconnectCRM = async (crmId: string, connectionId: string) => {
        setConnecting(crmId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            console.log(`[CRM] Disconnecting ${crmId} for agent ${agentId}`);

            // Remove from agent_integrations
            const { error } = await supabase
                .from('agent_integrations')
                .delete()
                .eq('agent_id', agentId)
                .eq('app_name', crmId.toUpperCase());

            if (error) throw error;

            // Optionally revoke Composio connection
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/composio/disconnect`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'X-User-Id': session.user.id
                },
                body: JSON.stringify({ connectionId })
            });

            toast.success(`${crmId} disconnected`);
            fetchConnections();
        } catch (e: any) {
            console.error(`[CRM] Disconnect error:`, e);
            toast.error(e.message || 'Failed to disconnect');
        } finally {
            setConnecting(null);
        }
    };

    const isConnected = (crmId: string) => {
        return connections.some(c => c.appName.toLowerCase() === crmId.toLowerCase() && c.connectionStatus === 'connected');
    };

    const getConnection = (crmId: string) => {
        return connections.find(c => c.appName.toLowerCase() === crmId.toLowerCase());
    };

    if (loading) {
        return <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold">CRM Integration</h3>
                <p className="text-sm text-gray-500">Connect your CRM to automatically sync leads captured by this agent.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CRM_LIST.map(crm => {
                    const connected = isConnected(crm.id);
                    const conn = getConnection(crm.id);
                    const isLoading = connecting === crm.id;
                    // All CRMs are Coming Soon for now
                    const isComingSoon = ['hubspot', 'salesforce', 'pipedrive'].includes(crm.id);

                    return (
                        <Card key={crm.id} className={`border-2 ${connected ? 'border-green-500 bg-green-50' : isComingSoon ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-200'} relative`}>
                            {isComingSoon && (
                                <div className="absolute top-2 right-2">
                                    <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs">
                                        Coming Soon
                                    </Badge>
                                </div>
                            )}
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <img 
                                        src={crm.logo} 
                                        alt={crm.name} 
                                        className={`w-10 h-10 object-contain ${isComingSoon ? 'grayscale' : ''}`}
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=' + crm.name[0]; }}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{crm.name}</span>
                                            {connected && (
                                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                                    Connected
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{crm.description}</p>
                                        
                                        <div className="mt-3">
                                            {isComingSoon ? (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    disabled
                                                    className="opacity-50 cursor-not-allowed"
                                                >
                                                    <Link2 className="w-3 h-3 mr-1" />
                                                    Coming Soon
                                                </Button>
                                            ) : connected ? (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => disconnectCRM(crm.id, conn?.connectionId || '')}
                                                    disabled={isLoading || isViewer}
                                                className={`text-red-600 hover:bg-red-50 ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Unlink className="w-3 h-3 mr-1" />}
                                                    Disconnect
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => connectCRM(crm.id)}
                                                    disabled={isLoading || isViewer}
                                                className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                                                >
                                                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
                                                    Connect
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <p className="text-xs text-gray-400">
                When connected, your agent can automatically create/update contacts in your CRM when leads are captured during chat.
            </p>
        </div>
    );
}
