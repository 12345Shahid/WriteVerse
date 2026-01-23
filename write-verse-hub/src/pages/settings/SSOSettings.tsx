import React, { useState, useEffect } from 'react';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Shield, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTeam } from '@/context/TeamContext';

export default function SSOSettings() {
    const { currentTeam } = useTeam();
    const isViewer = currentTeam?.role === 'viewer';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ssoEnabled, setSsoEnabled] = useState(false);
    const [ssoConfig, setSsoConfig] = useState({
        workosOrgId: '',
        domains: '',
        enforceSSO: false
    });
    const [ssoStatus, setSsoStatus] = useState<'not_configured' | 'pending' | 'active'>('not_configured');
    const [orgId, setOrgId] = useState<string | null>(null);
    const [subscriptionTier, setSubscriptionTier] = useState('');

    useEffect(() => {
        fetchSSOConfig();
    }, []);

    const fetchSSOConfig = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get org
            const { data: mem } = await supabase.from('organization_members')
                .select('organization_id, organizations(id, name, subscription_tier, sso_config)')
                .eq('user_id', user.id)
                .limit(1)
                .single();
            
            if (mem) {
                setOrgId(mem.organization_id);
                const org = mem.organizations as any;
                setSubscriptionTier(org?.subscription_tier || 'starter');
                
                if (org?.sso_config) {
                    setSsoConfig(org.sso_config);
                    setSsoEnabled(!!org.sso_config.workosOrgId);
                    setSsoStatus(org.sso_config.workosOrgId ? 'active' : 'not_configured');
                }
            }
        } catch (e) {
            console.error('[SSO] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        if (!orgId) return;
        setSaving(true);

        try {
            const { error } = await supabase
                .from('organizations')
                .update({ sso_config: ssoConfig })
                .eq('id', orgId);

            if (error) throw error;

            toast.success('SSO configuration saved');
            setSsoStatus(ssoConfig.workosOrgId ? 'active' : 'not_configured');
        } catch (e: any) {
            console.error('[SSO] Save error:', e);
            toast.error(e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const isEnterprise = subscriptionTier === 'enterprise' || subscriptionTier === 'business';

    if (loading) {
        return (
            <ToolLayout title="SSO Settings" description="Enterprise single sign-on configuration">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            </ToolLayout>
        );
    }

    return (
        <ToolLayout title="SSO Settings" description="Enterprise single sign-on configuration">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Status Card */}
                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Shield className="w-6 h-6" />
                                <CardTitle>Single Sign-On (SSO)</CardTitle>
                            </div>
                            <Badge variant={ssoStatus === 'active' ? 'default' : 'outline'}>
                                {ssoStatus === 'active' && <Check className="w-3 h-3 mr-1" />}
                                {ssoStatus === 'active' ? 'Active' : 'Not Configured'}
                            </Badge>
                        </div>
                        <CardDescription>
                            Allow team members to sign in with your company's identity provider (Okta, Azure AD, Google Workspace, etc.)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!isEnterprise && (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-yellow-800">Enterprise Feature</p>
                                    <p className="text-sm text-yellow-700">SSO is available on Enterprise plans. <a href="/subscription" className="underline">Upgrade to enable</a>.</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>WorkOS Organization ID</Label>
                                <Input
                                    value={ssoConfig.workosOrgId}
                                    onChange={(e) => setSsoConfig(s => ({ ...s, workosOrgId: e.target.value }))}
                                    placeholder="org_xxxxx"
                                    disabled={!isEnterprise || isViewer}
                                className={isViewer ? 'opacity-50' : ''}
                                />
                                <p className="text-xs text-gray-500">
                                    Get this from your WorkOS dashboard. <a href="https://dashboard.workos.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open WorkOS <ExternalLink className="w-3 h-3 inline" /></a>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Allowed Email Domains</Label>
                                <Input
                                    value={ssoConfig.domains}
                                    onChange={(e) => setSsoConfig(s => ({ ...s, domains: e.target.value }))}
                                    placeholder="example.com, company.org"
                                    disabled={!isEnterprise || isViewer}
                                className={isViewer ? 'opacity-50' : ''}
                                />
                                <p className="text-xs text-gray-500">
                                    Comma-separated list of email domains that can sign in via SSO.
                                </p>
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <p className="font-medium">Enforce SSO</p>
                                    <p className="text-sm text-gray-500">Require all users with these domains to sign in via SSO</p>
                                </div>
                                <Switch
                                    checked={ssoConfig.enforceSSO}
                                    onCheckedChange={(c) => setSsoConfig(s => ({ ...s, enforceSSO: c }))}
                                    disabled={!isEnterprise || isViewer}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={fetchSSOConfig}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={saveConfig}
                                disabled={!isEnterprise || saving || isViewer}
                            className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Save Configuration
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Setup Guide */}
                <Card className="border-2 border-gray-200">
                    <CardHeader>
                        <CardTitle className="text-base">Setup Guide</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                        <ol className="list-decimal list-inside space-y-2 text-gray-600">
                            <li>Sign up for WorkOS at <a href="https://workos.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">workos.com</a></li>
                            <li>Create an organization in WorkOS dashboard</li>
                            <li>Configure your identity provider (Okta, Azure AD, etc.)</li>
                            <li>Copy the Organization ID and paste above</li>
                            <li>Add your company email domains</li>
                            <li>Save and test by logging out and signing in via SSO</li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </ToolLayout>
    );
}
