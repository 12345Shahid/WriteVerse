import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    MessageSquare, 
    Users, 
    AlertTriangle, 
    TrendingUp,
    Loader2
} from "lucide-react";
import { supabase } from '@/lib/supabase';

interface AnalyticsData {
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    escalationRate: number;
    recentSessions: any[];
}

export function AgentAnalytics({ agentId }: { agentId: string }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (agentId) fetchAnalytics();
    }, [agentId]);

    const fetchAnalytics = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/${agentId}/analytics`, {
                headers: { 
                    'Authorization': `Bearer ${session?.access_token}`,
                    'X-User-Id': session?.user.id || ''
                }
            });
            if (!res.ok) throw new Error('Failed to load analytics');
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>;
    }

    if (!data) {
        return <div className="text-center text-gray-500 py-8">Unable to load analytics.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold">Chat Analytics</h3>
                <p className="text-sm text-gray-500">Overview of your chatbot's performance.</p>
            </div>

            {/* Stat Cards - Premium Dark Theme */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 border border-slate-700">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-5 h-5 text-blue-400" />
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Chats</span>
                        </div>

                        <div className="text-3xl font-bold text-white">{data.totalConversations.toLocaleString()}</div>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-5">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-5 h-5 text-white/80" />
                            <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Messages</span>
                        </div>

                        <div className="text-3xl font-bold text-white">{data.totalMessages.toLocaleString()}</div>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 border border-slate-700">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-xl"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Avg/Chat</span>
                        </div>

                        <div className="text-3xl font-bold text-white">{data.avgMessagesPerSession}</div>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 border border-slate-700">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-xl"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className={`w-5 h-5 ${data.escalationRate > 20 ? 'text-red-400' : 'text-amber-400'}`} />
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Escalation</span>
                        </div>

                        <div className="text-3xl font-bold text-white">{data.escalationRate}%</div>
                    </div>
                </div>
            </div>

            {/* Recent Conversations */}
            <div>
                <h4 className="font-semibold mb-3">Recent Conversations</h4>
                {data.recentSessions.length === 0 ? (
                    <div className="text-gray-500 italic">No conversations yet.</div>
                ) : (
                    <div className="space-y-2">
                        {data.recentSessions.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                <div>
                                    <div className="font-medium">{s.title || 'Untitled'}</div>
                                    <div className="text-xs text-gray-500">{s.customer_email || 'Anonymous'}</div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        s.status === 'escalated' ? 'bg-red-100 text-red-700' :
                                        s.status === 'closed' ? 'bg-gray-200 text-gray-700' :
                                        'bg-green-100 text-green-700'
                                    }`}>
                                        {s.status || 'active'}
                                    </span>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {new Date(s.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
