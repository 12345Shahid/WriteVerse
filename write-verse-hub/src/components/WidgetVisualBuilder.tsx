import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Save, RefreshCw, Upload, Image as ImageIcon, Smile, Mic, MessageSquare, Home } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";

interface WidgetSettings {
    primaryColor: string;
    botName: string;
    welcomeMessage: string;
    description: string;
    showHomeView: boolean;
    enableFileUpload: boolean;
    enableVoice: boolean;
    enableEmoji: boolean;
    logo?: string;
    clarityId?: string;
}

const DEFAULT_SETTINGS: WidgetSettings = {
    primaryColor: '#007AFF',
    botName: 'Support Agent',
    welcomeMessage: 'Hi there! 👋 How can we help you today?',
    description: 'We typically reply in a few minutes.',
    showHomeView: true,
    enableFileUpload: true,
    enableVoice: true,
    enableEmoji: true,
    clarityId: '',
};

export function WidgetVisualBuilder({ agentId, initialSettings }: { agentId: string, initialSettings?: any }) {
    const [settings, setSettings] = useState<WidgetSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('style');

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/${agentId}/widget-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ settings })
            });
            if (!res.ok) throw new Error('Failed to save');
            toast.success("Widget settings saved!");
        } catch (e) {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-200px)]">
            {/* Left Panel: Controls */}
            <div className="flex-1 overflow-y-auto pr-4 border-r border-gray-200 min-h-[500px]">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Customize Widget</h2>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-black text-white hover:bg-gray-800">
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="style">Style & Branding</TabsTrigger>
                        <TabsTrigger value="content">Content</TabsTrigger>
                        <TabsTrigger value="features">Features</TabsTrigger>
                    </TabsList>

                    <TabsContent value="style" className="space-y-6">
                        <div className="space-y-2">
                            <Label>Primary Color</Label>
                            <div className="flex gap-2 items-center">
                                <Input 
                                    type="color" 
                                    value={settings.primaryColor} 
                                    onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                                    className="w-12 h-12 p-1 rounded-lg cursor-pointer"
                                />
                                <Input 
                                    value={settings.primaryColor} 
                                    onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                                    className="uppercase font-mono"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2 pt-4 border-t">
                            <Label>Clarity Project ID (Microsoft Clarity)</Label>
                            <Input 
                                value={settings.clarityId || ''} 
                                onChange={(e) => setSettings(s => ({ ...s, clarityId: e.target.value }))}
                                placeholder="e.g., k92dfs8x"
                            />
                            <p className="text-xs text-gray-500">Get your Project ID from <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">clarity.microsoft.com</a>. Session recordings will be enabled for your chatbot.</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="content" className="space-y-6">
                        <div className="space-y-2">
                            <Label>Bot Name</Label>
                            <Input 
                                value={settings.botName} 
                                onChange={(e) => setSettings(s => ({ ...s, botName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Welcome Message</Label>
                            <textarea 
                                className="w-full p-2 border rounded-md min-h-[80px]"
                                value={settings.welcomeMessage} 
                                onChange={(e) => setSettings(s => ({ ...s, welcomeMessage: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description (Home View)</Label>
                             <textarea 
                                className="w-full p-2 border rounded-md min-h-[60px]"
                                value={settings.description} 
                                onChange={(e) => setSettings(s => ({ ...s, description: e.target.value }))}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="features" className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                            <div className="space-y-0.5">
                                <Label className="text-base">Home View</Label>
                                <div className="text-sm text-gray-500">Show a landing screen before chat</div>
                            </div>
                            <Switch 
                                checked={settings.showHomeView}
                                onCheckedChange={(c) => setSettings(s => ({ ...s, showHomeView: c }))}
                            />
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                             <h3 className="font-semibold text-sm text-gray-900">Input Toolbar</h3>
                             
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-gray-500" />
                                    <Label>File Uploads</Label>
                                </div>
                                <Switch 
                                    checked={settings.enableFileUpload}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, enableFileUpload: c }))}
                                />
                            </div>

                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mic className="w-4 h-4 text-gray-500" />
                                    <Label>Voice Input</Label>
                                </div>
                                <Switch 
                                    checked={settings.enableVoice}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, enableVoice: c }))}
                                />
                            </div>

                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Smile className="w-4 h-4 text-gray-500" />
                                    <Label>Emoji Picker</Label>
                                </div>
                                <Switch 
                                    checked={settings.enableEmoji}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, enableEmoji: c }))}
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Right Panel: Live Preview */}
            <div className="flex-1 bg-gray-100 rounded-xl p-4 lg:p-8 flex items-center justify-center relative shadow-inner overflow-hidden">
                <div className="absolute top-4 right-4 text-xs font-mono text-gray-400">LIVE PREVIEW</div>
                
                {/* Mock Widget UI */}
                <div className="w-full max-w-[375px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
                    
                    {/* Header */}
                    <div className="p-4 text-white flex items-center justify-between" style={{ backgroundColor: settings.primaryColor }}>
                        <div className="flex items-center gap-2">
                             {/* Avatar placeholder */}
                             <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs">🤖</div>
                             <span className="font-medium">{settings.botName}</span>
                        </div>
                        <div className="flex gap-2">
                             <span className="opacity-70">×</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
                        {settings.showHomeView && (
                             <div className="absolute inset-0 bg-white z-10 flex flex-col p-6">
                                <div className="mt-8">
                                    <h2 className="text-2xl font-bold mb-2">Hi there 👋</h2>
                                    <h3 className="text-xl font-semibold mb-4 text-gray-800">How can we help?</h3>
                                    
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 cursor-pointer hover:shadow-md transition-shadow">
                                        <div className="text-xs text-gray-500 mb-1">Recent message</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Checking order status...</span>
                                            <span className="text-gray-400">›</span>
                                        </div>
                                    </div>

                                    <div 
                                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow group"
                                    >
                                        <div>
                                            <div className="font-semibold text-blue-600 group-hover:underline">Send us a message</div>
                                            <div className="text-xs text-gray-500">{settings.description}</div>
                                        </div>
                                        <MessageSquare className="w-5 h-5 text-blue-600" />
                                    </div>
                                </div>
                             </div>
                        )}

                        {/* Chat View Mock (Only visible if Home View is hidden) */}
                        <div className={`flex-1 p-4 space-y-4 bg-gray-50 overflow-y-auto ${settings.showHomeView ? 'invisible' : ''}`}>
                            <div className="flex justify-start">
                                <div className="bg-white border rounded-bl-none rounded-2xl py-2 px-3 text-sm shadow-sm max-w-[80%]">
                                    {settings.welcomeMessage}
                                </div>
                            </div>
                        </div>

                         {/* Input Area */}
                        <div className="p-3 bg-white border-t">
                             {/* Toolbar */}
                             <div className={`flex items-center gap-3 mb-2 px-1 ${(settings.enableEmoji || settings.enableFileUpload || settings.enableVoice) ? 'flex' : 'hidden'}`}>
                                {settings.enableFileUpload && <Upload className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />}
                                {settings.enableEmoji && <Smile className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />}
                                {settings.enableVoice && <Mic className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />}
                             </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" 
                                    placeholder="Type a message..." 
                                />
                                <button className="p-2 rounded-full bg-blue-500 text-white" style={{ backgroundColor: settings.primaryColor }}>
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
