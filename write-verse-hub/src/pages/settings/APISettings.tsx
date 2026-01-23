import React, { useState, useEffect } from 'react';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Key, Copy, Trash, Plus, Eye, EyeOff, Code, ExternalLink, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTeam } from '@/context/TeamContext';

interface APIKey {
    id: string;
    name: string;
    public_key: string;
    created_at: string;
    last_used_at: string | null;
}

export default function APISettings() {
    const { currentTeam } = useTeam();
    const isViewer = currentTeam?.role === 'viewer';
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [keys, setKeys] = useState<APIKey[]>([]);
    const [newKeyName, setNewKeyName] = useState('');
    const [showKey, setShowKey] = useState<string | null>(null);
    const [usage, setUsage] = useState({ today: 0, thisMonth: 0 });
    const [subscriptionTier, setSubscriptionTier] = useState('starter');

    useEffect(() => {
        fetchData();
    }, [currentTeam?.id]);

    const fetchData = async () => {
        if (!currentTeam?.id) return;
        setLoading(true);
        
        try {
            // Fetch API keys
            const { data: keysData, error: keysErr } = await supabase
                .from('organization_api_keys')
                .select('id, name, public_key, created_at, last_used_at')
                .eq('organization_id', currentTeam.id)
                .order('created_at', { ascending: false });
            
            if (keysErr) throw keysErr;
            setKeys(keysData || []);

            // Fetch org subscription tier
            const { data: org } = await supabase
                .from('organizations')
                .select('subscription_tier')
                .eq('id', currentTeam.id)
                .single();
            
            setSubscriptionTier(org?.subscription_tier || 'starter');

            // Fetch usage stats (today and this month)
            const today = new Date().toISOString().split('T')[0];
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

            const { count: todayCount } = await supabase
                .from('api_usage_logs')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', currentTeam.id)
                .gte('created_at', today);

            const { count: monthCount } = await supabase
                .from('api_usage_logs')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', currentTeam.id)
                .gte('created_at', monthStart);

            setUsage({ today: todayCount || 0, thisMonth: monthCount || 0 });
            console.log('[API Settings] Data loaded:', { keys: keysData?.length, tier: org?.subscription_tier });
        } catch (e) {
            console.error('[API Settings] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    const createKey = async () => {
        if (!currentTeam?.id || !newKeyName.trim()) return;
        setCreating(true);

        try {
            // Generate a random API key
            const key = 'wv_' + crypto.randomUUID().replace(/-/g, '').substring(0, 32);
            
            const { data, error } = await supabase
                .from('organization_api_keys')
                .insert({
                    organization_id: currentTeam.id,
                    name: newKeyName.trim(),
                    public_key: key
                })
                .select()
                .single();

            if (error) throw error;

            setKeys(prev => [data, ...prev]);
            setNewKeyName('');
            setShowKey(data.id); // Show the new key
            toast.success('API key created! Copy it now - you won\'t see it again.');
            console.log('[API Settings] Key created:', data.name);
        } catch (e: any) {
            console.error('[API Settings] Create error:', e);
            toast.error(e.message || 'Failed to create key');
        } finally {
            setCreating(false);
        }
    };

    const deleteKey = async (keyId: string) => {
        if (!confirm('Delete this API key? This cannot be undone.')) return;

        try {
            const { error } = await supabase
                .from('organization_api_keys')
                .delete()
                .eq('id', keyId);

            if (error) throw error;

            setKeys(prev => prev.filter(k => k.id !== keyId));
            toast.success('API key deleted');
            console.log('[API Settings] Key deleted:', keyId);
        } catch (e: any) {
            console.error('[API Settings] Delete error:', e);
            toast.error(e.message || 'Failed to delete');
        }
    };

    const copyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        toast.success('Copied to clipboard');
    };

    const hasAPIAccess = ['professional', 'business', 'enterprise'].includes(subscriptionTier.toLowerCase());
    
    const rateLimits = {
        professional: { perMinute: 50, perDay: 5000 },
        business: { perMinute: 100, perDay: 10000 },
        enterprise: { perMinute: 500, perDay: 'Unlimited' }
    };

    const currentLimits = rateLimits[subscriptionTier.toLowerCase() as keyof typeof rateLimits] || { perMinute: 0, perDay: 0 };

    if (loading) {
        return (
            <ToolLayout title="API Access" description="Manage your API keys and access">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            </ToolLayout>
        );
    }

    return (
        <ToolLayout title="API Access" description="Programmatic access to WriteVerse Hub">
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Access Status */}
                {!hasAPIAccess && (
                    <Card className="border-2 border-yellow-400 bg-yellow-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Key className="w-5 h-5 text-yellow-600" />
                            <div className="flex-1">
                                <p className="font-medium text-yellow-800">API Access Requires Professional Plan or Higher</p>
                                <p className="text-sm text-yellow-700">Upgrade to unlock programmatic access to all tools.</p>
                            </div>
                            <Button onClick={() => window.location.href = '/subscription'}>
                                Upgrade
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Usage Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-4 text-center">
                            <BarChart3 className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                            <p className="text-2xl font-bold">{usage.today}</p>
                            <p className="text-sm text-gray-500">Requests Today</p>
                        </CardContent>
                    </Card>
                    <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-4 text-center">
                            <BarChart3 className="w-6 h-6 mx-auto mb-2 text-green-600" />
                            <p className="text-2xl font-bold">{usage.thisMonth}</p>
                            <p className="text-sm text-gray-500">Requests This Month</p>
                        </CardContent>
                    </Card>
                    <Card className="border-2 border-black shadow-brutal">
                        <CardContent className="p-4 text-center">
                            <Key className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                            <p className="text-2xl font-bold">{currentLimits.perMinute}/{typeof currentLimits.perDay === 'number' ? currentLimits.perDay.toLocaleString() : currentLimits.perDay}</p>
                            <p className="text-sm text-gray-500">Rate Limit (min/day)</p>
                        </CardContent>
                    </Card>
                </div>

                {/* API Keys */}
                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5" />
                            API Keys
                        </CardTitle>
                        <CardDescription>
                            Create and manage API keys for programmatic access
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Create New Key */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Key name (e.g., Production, Development)"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                disabled={!hasAPIAccess || isViewer}
                            />
                            <Button
                                onClick={createKey}
                                disabled={!hasAPIAccess || creating || !newKeyName.trim() || isViewer}
                                className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                                Create Key
                            </Button>
                        </div>

                        {/* Keys List */}
                        <div className="space-y-2">
                            {keys.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No API keys yet. Create one to get started.</p>
                            ) : (
                                keys.map(key => (
                                    <div key={key.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex-1">
                                            <p className="font-medium">{key.name}</p>
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                {showKey === key.id ? (
                                                    <code className="bg-gray-200 px-2 py-0.5 rounded">{key.public_key}</code>
                                                ) : (
                                                    <code className="bg-gray-200 px-2 py-0.5 rounded">wv_••••••••••••••••</code>
                                                )}
                                                <button onClick={() => setShowKey(showKey === key.id ? null : key.id)}>
                                                    {showKey === key.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Created {new Date(key.created_at).toLocaleDateString()}
                                                {key.last_used_at && ` • Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                                            </p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => copyKey(key.public_key)}>
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" className={`text-red-600 hover:bg-red-50 ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => deleteKey(key.id)} disabled={isViewer}>
                                            <Trash className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* API Documentation */}
                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Code className="w-5 h-5" />
                            Quick Start
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                            <pre className="text-sm">{`# Generate content using a tool
curl -X POST ${window.location.origin}/api/v1/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "blog_post",
    "inputs": {
      "topic": "AI in Healthcare",
      "targetAudience": "Tech professionals"
    },
    "options": {
      "brandVoiceId": "optional-brand-voice-id",
      "modelId": "gemini-2.0-flash"
    }
  }'`}</pre>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <h4 className="font-semibold mb-2">Available Endpoints</h4>
                                <ul className="space-y-1 text-gray-600">
                                    <li><code className="bg-gray-100 px-1">GET /api/v1/tools</code> - List tools</li>
                                    <li><code className="bg-gray-100 px-1">POST /api/v1/generate</code> - Generate content</li>
                                    <li><code className="bg-gray-100 px-1">GET /api/v1/workflows</code> - List workflows</li>
                                    <li><code className="bg-gray-100 px-1">POST /api/v1/workflows/:id/run</code> - Run workflow</li>
                                    <li><code className="bg-gray-100 px-1">GET /api/v1/templates</code> - List templates</li>
                                    <li><code className="bg-gray-100 px-1">POST /api/v1/templates/:id/run</code> - Run template</li>
                                    <li><code className="bg-gray-100 px-1">GET /api/v1/brand-voices</code> - List brand voices</li>
                                    <li><code className="bg-gray-100 px-1">GET /api/v1/models</code> - List AI models</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Response Headers</h4>
                                <ul className="space-y-1 text-gray-600">
                                    <li><code className="bg-gray-100 px-1">X-RateLimit-Limit</code> - Requests per minute</li>
                                    <li><code className="bg-gray-100 px-1">X-RateLimit-Remaining</code> - Remaining requests</li>
                                    <li><code className="bg-gray-100 px-1">X-RateLimit-Reset</code> - Seconds until reset</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ToolLayout>
    );
}
