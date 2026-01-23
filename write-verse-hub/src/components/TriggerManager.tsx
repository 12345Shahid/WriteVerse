import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";

interface Trigger {
    id?: string;
    url_pattern: string;
    message: string;
    delay_seconds: number;
    is_enabled: boolean;
}

export function TriggerManager({ agentId, isViewer = false }: { agentId: string; isViewer?: boolean }) {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (agentId) fetchTriggers();
    }, [agentId]);

    const fetchTriggers = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/${agentId}/triggers`, {
                headers: { 
                    'Authorization': `Bearer ${session?.access_token}`,
                    'X-User-Id': session?.user.id || ''
                }
            });
            if (!res.ok) throw new Error('Failed to load triggers');
            const data = await res.json();
            setTriggers(data.triggers || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addTrigger = () => {
        setTriggers([...triggers, {
            url_pattern: '/*',
            message: 'Hi there! 👋 Need any help?',
            delay_seconds: 5,
            is_enabled: true
        }]);
    };

    const updateTrigger = (index: number, field: keyof Trigger, value: any) => {
        const updated = [...triggers];
        updated[index] = { ...updated[index], [field]: value };
        setTriggers(updated);
    };

    const removeTrigger = async (index: number) => {
        const trigger = triggers[index];
        if (trigger.id) {
            // Delete from server
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/${agentId}/triggers/${trigger.id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${session?.access_token}`,
                    'X-User-Id': session?.user.id || ''
                }
            });
        }
        setTriggers(triggers.filter((_, i) => i !== index));
    };

    const saveTriggers = async () => {
        setSaving(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        try {
            for (const trigger of triggers) {
                if (trigger.id) {
                    // Update existing
                    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/${agentId}/triggers/${trigger.id}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                            'X-User-Id': session?.user.id || ''
                        },
                        body: JSON.stringify(trigger)
                    });
                } else {
                    // Create new
                    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/${agentId}/triggers`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                            'X-User-Id': session?.user.id || ''
                        },
                        body: JSON.stringify(trigger)
                    });
                    const data = await res.json();
                    if (data.trigger?.id) {
                        trigger.id = data.trigger.id;
                    }
                }
            }
            toast.success('Triggers saved!');
            fetchTriggers(); // Refresh
        } catch (e: any) {
            toast.error(e.message || 'Failed to save triggers');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">Proactive Messages</h3>
                    <p className="text-sm text-gray-500">Automatically show a message to visitors based on the page they're on.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={addTrigger} disabled={isViewer} className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}>
                    <Plus className="w-4 h-4 mr-1" /> Add Trigger
                </Button>
                <Button onClick={saveTriggers} disabled={saving || isViewer} className={`bg-black text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                        Save
                    </Button>
                </div>
            </div>

            {triggers.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No triggers configured. Click "Add Trigger" to create one.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {triggers.map((trigger, i) => (
                        <div key={i} className="border-2 border-black rounded-lg p-4 bg-white space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>URL Pattern</Label>
                                            <Input 
                                                value={trigger.url_pattern} 
                                                onChange={e => updateTrigger(i, 'url_pattern', e.target.value)}
                                                placeholder="/pricing*, /*, /docs/*"
                                                disabled={isViewer}
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Use * as wildcard</p>
                                        </div>
                                        <div>
                                            <Label>Delay (seconds)</Label>
                                            <Input 
                                                type="number"
                                                min={1}
                                                max={60}
                                                value={trigger.delay_seconds} 
                                                onChange={e => updateTrigger(i, 'delay_seconds', parseInt(e.target.value) || 5)}
                                                disabled={isViewer}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Message</Label>
                                        <textarea 
                                            className="w-full p-2 border-2 border-black rounded-md"
                                            rows={2}
                                            value={trigger.message} 
                                            onChange={e => updateTrigger(i, 'message', e.target.value)}
                                            placeholder="Hi there! 👋 Need any help?"
                                            disabled={isViewer}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Switch 
                                        checked={trigger.is_enabled} 
                                        onCheckedChange={v => updateTrigger(i, 'is_enabled', v)}
                                        disabled={isViewer}
                                    />
                                    <Button variant="ghost" size="sm" onClick={() => removeTrigger(i)} disabled={isViewer} className={`text-red-500 hover:text-red-700 hover:bg-red-50 ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
