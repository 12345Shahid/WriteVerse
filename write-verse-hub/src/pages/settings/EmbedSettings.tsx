import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/context/TeamContext';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Plus, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WidgetVisualBuilder } from '@/components/WidgetVisualBuilder';
import { TriggerManager } from '@/components/TriggerManager';
import { AgentAnalytics } from '@/components/AgentAnalytics';
import { AgentCRMConnector } from '@/components/AgentCRMConnector';

export default function EmbedSettings() {
    const { currentTeam } = useTeam();
    const isViewer = currentTeam?.role === 'viewer';
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [keys, setKeys] = useState<any[]>([]);
    const [orgId, setOrgId] = useState<string | null>(null);
    // Load saved agent selection from localStorage
    const [selectedBotId, setSelectedBotId] = useState(() => {
        return localStorage.getItem('selectedAgentId') || '';
    });
    const [agents, setAgents] = useState<any[]>([]);

    // Save agent selection to localStorage whenever it changes
    useEffect(() => {
        if (selectedBotId) {
            localStorage.setItem('selectedAgentId', selectedBotId);
        }
    }, [selectedBotId]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get Org - Try to get the first organization the user is a member of
            const { data: mem, error } = await supabase.from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1)
                .single();
            
            if (mem) {
                setOrgId(mem.organization_id);
                await fetchKeys(mem.organization_id);
                await fetchAgents(mem.organization_id);
            } else {
                console.warn('No organization found for user', user.id);
            }
        } catch (error) {
            console.error('Error fetching embed data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchKeys = async (orgId: string) => {
        const { data, error } = await supabase.from('organization_api_keys')
            .select('*').eq('organization_id', orgId);
        if (error) console.error('Error fetching keys:', error);
        setKeys(data || []);
    };
    
    const fetchAgents = async (orgId: string) => {
        console.log('Fetching agents for Org:', orgId);
        const { data, error } = await supabase.from('agents')
            .select('id, name, organization_id, widget_settings')
            .eq('organization_id', orgId);
        
        if (error) {
            console.error('Error fetching agents:', error);
        } else {
            console.log('Agents found:', data);
            setAgents(data || []);
            
            // Check if saved agent exists in the list, otherwise use first agent
            const savedAgentId = localStorage.getItem('selectedAgentId');
            const savedAgentExists = data?.some(a => a.id === savedAgentId);
            
            if (savedAgentId && savedAgentExists) {
                setSelectedBotId(savedAgentId);
            } else if (data && data.length > 0 && !selectedBotId) {
                setSelectedBotId(data[0].id);
            }
        }
    };

    const createKey = async () => {
        if (!orgId) {
            toast({ title: 'Error', description: 'No Organization found. Please create an organization first.', variant: 'destructive' });
            return;
        }
        const name = prompt('Enter a name for this key (e.g. "Website Widget")');
        if (!name) return;

        const publicKey = `pk_live_${Math.random().toString(36).substring(2, 15)}`;
        
        const { error } = await supabase.from('organization_api_keys').insert({
            organization_id: orgId,
            name,
            public_key: publicKey
        });

        if (error) {
            console.error('Create Key Error:', error);
            toast({ title: 'Error', description: error.message || 'Failed to create key. Did you run the SQL migration?', variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'API Key created' });
            fetchKeys(orgId);
        }
    };

    const deleteKey = async (id: string) => {
        if (!confirm('Are you sure? This will break any widgets using this key.')) return;
        const { error } = await supabase.from('organization_api_keys').delete().eq('id', id);
        if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
        else fetchKeys(orgId!);
    };

    const generateSnippet = () => {
        const key = keys.length > 0 ? keys[0].public_key : 'YOUR_API_KEY';
        const origin = window.location.origin;
        
        return `<script src="${origin}/embed/chatbot.js"></script>
<script>
  WriterAIChat.init({
    botId: '${selectedBotId || 'YOUR_BOT_ID'}',
    apiKey: '${key}',
    apiUrl: '${origin}',
    collectEmail: true
  });
</script>`;
    };

    return (
        <ToolLayout title="Embed Settings" description="Configure your website chatbot">
            <div className="max-w-4xl mx-auto space-y-8 mt-6">
                
                {/* API Keys Section */}
                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>API Keys</CardTitle>
                                <p className="text-sm text-gray-500 mt-1">
                                    🔑 Organization-wide keys - works for <strong>all your agents</strong>
                                </p>
                            </div>
                            <Button onClick={createKey} disabled={isViewer} className="bg-black text-white hover:bg-gray-800">
                                <Plus className="w-4 h-4 mr-2"/> Create Key
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {keys.map(k => (
                                <div key={k.id} className="flex items-center justify-between p-4 border-2 border-gray-100 rounded-lg">
                                    <div>
                                        <div className="font-bold">{k.name} <span className="text-xs text-gray-400 font-normal ml-2">Universal Key</span></div>
                                        <div className="font-mono text-sm text-gray-500 mt-1">{k.public_key}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            navigator.clipboard.writeText(k.public_key);
                                            toast({ title: 'Copied API Key' });
                                        }}>
                                            <Copy className="w-4 h-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)} disabled={isViewer}>
                                            <Trash className="w-4 h-4 text-red-500"/>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {keys.length === 0 && <div className="text-gray-500 italic">No API keys found. Create one to get started.</div>}
                        </div>
                    </CardContent>
                </Card>

                {/* Config Generator */}
                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader><CardTitle>Code Generator</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Select Agent</Label>
                                    <Button 
                                        variant="link" 
                                        className="h-auto p-0 text-blue-600 hover:underline" 
                                        onClick={() => navigate('/agents/new')}
                                        disabled={isViewer}
                                    >
                                        + Create New Agent
                                    </Button>
                                </div>
                                <select 
                                    className="w-full p-2 border-2 border-black rounded-md"
                                    value={selectedBotId}
                                    onChange={e => setSelectedBotId(e.target.value)}
                                >
                                    <option value="">Select an Agent...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                {agents.length === 0 && <p className="text-xs text-red-500">No agents found in your organization.</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
                                <pre>{generateSnippet()}</pre>
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        navigator.clipboard.writeText(generateSnippet());
                                        toast({ title: 'Copied to clipboard' });
                                    }}
                                >
                                    <Copy className="w-3 h-3 mr-1"/> Copy
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground border-l-2 border-yellow-500 pl-3 py-1 bg-yellow-50">
                                <span className="font-bold text-yellow-700">Production Note:</span> If you copy this code from localhost, the URL will be local. 
                                Please copy this code from your <strong>Production URL</strong> after deployment.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Support Menu (Inbox Access) */}
                <Card className="border-2 border-black shadow-brutal bg-yellow-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span>Human Support</span>
                            <span className="text-xs font-normal bg-black text-white px-2 py-0.5 rounded-full">Admin Only</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                            Access escalated conversations where users have requested human assistance.
                        </p>
                        <Button 
                            onClick={() => {
                                console.log('[EmbedSettings] Navigating to escalated inbox with agentId:', selectedBotId);
                                navigate(`/agents/inbox?filter=escalated&agentId=${selectedBotId}`);
                            }} 
                            className="bg-black text-white hover:bg-gray-800 w-full sm:w-auto"
                        >
                            Open Support Inbox (Escalated)
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => {
                                console.log('[EmbedSettings] Navigating to all inbox with agentId:', selectedBotId);
                                navigate(`/agents/inbox?filter=all&agentId=${selectedBotId}`);
                            }} 
                            className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2"
                        >
                            Open All Inbox
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => navigate('/leads')} 
                            className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                            📋 Leadbase
                        </Button>
                    </CardContent>
                </Card>

                {/* Visual Builder */}
                {selectedBotId && (
                     <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-6">
                            <WidgetVisualBuilder 
                                agentId={selectedBotId} 
                                initialSettings={agents.find(a => a.id === selectedBotId)?.widget_settings} 
                                key={selectedBotId} // Force re-render on change
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Proactive Messages Manager */}
                {selectedBotId && (
                    <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-6">
                            <TriggerManager agentId={selectedBotId} isViewer={isViewer} />
                        </CardContent>
                    </Card>
                )}

                {/* Analytics Dashboard */}
                {selectedBotId && (
                    <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-6">
                            <AgentAnalytics agentId={selectedBotId} />
                        </CardContent>
                    </Card>
                )}

                {/* CRM Integration */}
                {selectedBotId && (
                    <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-6">
                            <AgentCRMConnector agentId={selectedBotId} isViewer={isViewer} />
                        </CardContent>
                    </Card>
                )}
            </div>
        </ToolLayout>
    );
}
