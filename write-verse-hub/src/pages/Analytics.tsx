import { useEffect, useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { getCommonHeaders } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Zap, Bot, MessageSquare, Layers, FileText, LayoutTemplate } from "lucide-react";

export default function Analytics() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'user' | 'org'>('user');
    const [timeRange, setTimeRange] = useState('3m');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const headers = await getCommonHeaders();
            const res = await fetch('/api/analytics/dashboard', { headers });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return (
        <ToolLayout title="Analytics" description="Track credit consumption">
            <div className="p-10 text-center">Loading analytics...</div>
        </ToolLayout>
    );
    
    if (!data) return (
        <ToolLayout title="Analytics" description="Track credit consumption">
            <div className="p-10 text-center text-red-500">Failed to load analytics data.</div>
        </ToolLayout>
    );

    const { isAdmin, usage, storage } = data;
    const showOrg = viewMode === 'org';
    
    // Helper to get credits based on view and time range
    const getCredits = (item: any) => {
        const suffix = timeRange === '7d' ? '7d' : 
                       timeRange === '30d' ? '30d' : 
                       timeRange === '3m' ? '3m' : 'All';
                       
        const key = showOrg ? `totalCredits${suffix}` : `userTotal${suffix}`;
        return item[key] || 0;
    };

    // Filter items that have 0 usage in current view
    const filterUsage = (list: any[]) => list.filter(item => getCredits(item) > 0);

    const totalCredits = [...usage.tools, ...usage.workflows, ...usage.agents, ...usage.embeds, ...(usage.templates || [])]
        .reduce((acc: number, item: any) => acc + getCredits(item), 0);

    const getTimeLabel = () => {
        if (timeRange === '7d') return 'Last 7 Days';
        if (timeRange === '30d') return 'Last 30 Days';
        if (timeRange === '3m') return 'Last 3 Months';
        return 'All Time';
    };

    return (
        <ToolLayout title="Analytics" description="Track credit consumption and resource usage">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header / View Switcher */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                            <BarChart className="w-6 h-6 text-primary" />
                            {showOrg ? 'Organization Overview' : 'My Analytics'}
                        </h2>
                        <p className="text-muted-foreground">
                            {showOrg ? 'Viewing usage for the entire workspace.' : 'Viewing your personal usage.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[150px] border-2 border-black shadow-brutal">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7d">Last 7 Days</SelectItem>
                                <SelectItem value="30d">Last 30 Days</SelectItem>
                                <SelectItem value="3m">Last 3 Months</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>

                        {isAdmin && (
                            <div className="flex items-center gap-2 pl-2 border-l border-gray-300">
                                <span className="text-sm font-medium text-muted-foreground hidden sm:inline">View:</span>
                                <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                                    <SelectTrigger className="w-[140px] border-2 border-black shadow-brutal">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">My Analytics</SelectItem>
                                        <SelectItem value="org">Organization</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-2 border-black shadow-brutal transition-all hover:translate-y-[-2px]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase text-muted-foreground flex items-center gap-2">
                                <Zap className="w-4 h-4" /> Total Credits ({getTimeLabel()})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black tracking-tight text-foreground">
                                {totalCredits.toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-2 border-black shadow-brutal bg-blue-50/50 transition-all hover:translate-y-[-2px]">
                         <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase text-muted-foreground flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Files Storage
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black">{(storage.filesBytes / 1024 / 1024).toFixed(2)} MB</div>
                        </CardContent>
                    </Card>
                    <Card className="border-2 border-black shadow-brutal bg-purple-50/50 transition-all hover:translate-y-[-2px]">
                         <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase text-muted-foreground flex items-center gap-2">
                                <Bot className="w-4 h-4" /> Knowledge Base
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black">{storage.kbCount} Items</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Sections */}
                <Tabs defaultValue="tools" className="w-full">
                    <TabsList className="w-full justify-start border-b-2 border-black rounded-none bg-transparent p-0 gap-8 overflow-x-auto">
                        <TabsTrigger value="tools" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Specialized Tools
                        </TabsTrigger>
                        <TabsTrigger value="workflows" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Workflows
                        </TabsTrigger>
                        <TabsTrigger value="agents" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Custom Agents
                        </TabsTrigger>
                        <TabsTrigger value="embeds" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Embedded Chats
                        </TabsTrigger>
                        <TabsTrigger value="templates" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Templates
                        </TabsTrigger>
                        <TabsTrigger value="blogstudio" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Blog Studio
                        </TabsTrigger>
                        <TabsTrigger value="images" className="rounded-none border-b-4 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent px-0 py-3 font-bold uppercase text-muted-foreground data-[state=active]:text-foreground transition-all">
                            Images
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
                        <TabsContent value="tools">
                            <UsageTable items={filterUsage(usage.tools)} getCredits={getCredits} type="Tool" />
                        </TabsContent>
                        
                        <TabsContent value="workflows">
                            <UsageTable items={filterUsage(usage.workflows)} getCredits={getCredits} type="Workflow" />
                        </TabsContent>
                        
                        <TabsContent value="agents">
                            <UsageTable items={filterUsage(usage.agents)} getCredits={getCredits} type="Agent" />
                        </TabsContent>

                        <TabsContent value="embeds">
                            <UsageTable items={filterUsage(usage.embeds)} getCredits={getCredits} type="Bot" />
                        </TabsContent>

                        <TabsContent value="templates">
                            <UsageTable items={filterUsage(usage.templates || [])} getCredits={getCredits} type="Template" />
                        </TabsContent>

                        <TabsContent value="blogstudio">
                            <UsageTable 
                                items={filterUsage(usage.tools.filter((t: any) => 
                                    t.id?.toLowerCase().includes('blog') || 
                                    t.id?.toLowerCase().includes('seo') ||
                                    t.id?.toLowerCase().includes('article') ||
                                    t.id === 'blog_post'
                                ))} 
                                getCredits={getCredits} 
                                type="Blog" 
                            />
                        </TabsContent>

                        <TabsContent value="images">
                            <UsageTable 
                                items={filterUsage(usage.tools.filter((t: any) => 
                                    t.id?.toLowerCase().includes('image') ||
                                    t.id === 'image-generator'
                                ))} 
                                getCredits={getCredits} 
                                type="Image" 
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </ToolLayout>
    );
}

function UsageTable({ items, getCredits, type }: any) {
    if (items.length === 0) {
        return <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/20">
            No usage history found for {type}s in this view.
        </div>;
    }

    return (
        <div className="rounded-xl border-2 border-black shadow-brutal overflow-hidden bg-card">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 border-b-2 border-black">
                        <tr>
                            <th className="p-4 pl-6 font-bold uppercase tracking-wider text-xs text-muted-foreground">Name</th>
                            <th className="p-4 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">Last Used</th>
                            <th className="p-4 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">Last Cost</th>
                            <th className="p-4 pr-6 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">3-Month Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((item: any) => (
                            <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                <td className="p-4 pl-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors border border-primary/20">
                                            {type === 'Tool' && <Zap className="w-4 h-4" />}
                                            {type === 'Workflow' && <Layers className="w-4 h-4" />}
                                            {type === 'Agent' && <Bot className="w-4 h-4" />}
                                            {type === 'Bot' && <MessageSquare className="w-4 h-4" />}
                                            {type === 'Template' && <LayoutTemplate className="w-4 h-4" />}
                                        </div>
                                        <span className="font-bold text-foreground text-base">
                                            {item.name || formatToolName(item.id)}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-right text-muted-foreground">
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium text-foreground">
                                            {new Date(item.lastUsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <span className="text-xs opacity-70 font-mono">
                                            {new Date(item.lastUsed).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <Badge variant="secondary" className="font-mono text-xs border-black/20">
                                        {item.lastCredits} cr
                                    </Badge>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                    <span className="font-black font-mono text-primary text-lg">
                                        {getCredits(item, '3m').toLocaleString()}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function formatToolName(id: string) {
    return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
