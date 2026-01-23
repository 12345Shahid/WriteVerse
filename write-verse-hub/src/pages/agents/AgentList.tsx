import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button-brutal";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Edit, Bot, Tag, Copy, Check, Lock } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { usePermissions } from "@/hooks/usePermissions";

export default function AgentList() {
  const { canEdit, isViewer } = usePermissions();
  const { currentTeam } = useTeam();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyAgentId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy this Agent ID:', id);
    }
  };

  useEffect(() => {
    if (currentTeam) loadAgents();
  }, [currentTeam]);

  const loadAgents = async () => {
    const { data } = await supabase
      .from('agents')
      .select('*, tags:agent_tags(tag:tags(*))')
      .eq('organization_id', currentTeam?.id)
      .order('created_at', { ascending: false });
    
    const formatted = data?.map(a => ({
        ...a,
        tags: a.tags?.map((t: any) => t.tag) || []
    })) || [];

    setAgents(formatted);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">AI Agents</h1>
            <p className="text-muted-foreground">Custom bots with access to your Knowledge Base.</p>
          </div>
          {isViewer ? (
            <div className="bg-yellow-50 border-2 border-yellow-400 p-3 rounded flex items-center gap-2">
              <Lock className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-700 font-medium">Viewers can chat with agents but cannot create or edit them</p>
            </div>
          ) : (
            <Link to="/agents/new">
              <Button className="bg-black text-white">
                <Plus className="mr-2 h-4 w-4" /> New Agent
              </Button>
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
                <div key={agent.id} className="border-4 border-black bg-card p-6 shadow-brutal hover:translate-x-1 hover:-translate-y-1 transition-transform flex flex-col">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-purple-300 border-2 border-black p-2 rounded-full">
                            <Bot className="h-6 w-6"/>
                        </div>
                        <h3 className="text-xl font-bold">{agent.name}</h3>
                    </div>
                    
                    {/* Agent ID for workflows */}
                    <div className="flex items-center gap-2 mb-3 bg-slate-100 border border-black/10 rounded px-2 py-1">
                        <code className="text-[10px] text-muted-foreground font-mono break-all flex-1">{agent.id}</code>
                        <button 
                            onClick={() => copyAgentId(agent.id)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Copy Agent ID for workflows"
                        >
                            {copiedId === agent.id ? (
                                <Check className="h-3 w-3 text-green-600"/>
                            ) : (
                                <Copy className="h-3 w-3 text-muted-foreground"/>
                            )}
                        </button>
                    </div>
                    
                    <p className="text-muted-foreground text-sm mb-4 flex-1 line-clamp-3">
                        {agent.description || 'No description provided.'}
                    </p>
                    
                    {/* Tags Display */}
                    {agent.tags && agent.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {agent.tags.map((tag: any) => (
                                <Badge key={tag.id} variant="secondary" className="text-xs font-normal border border-black/20 bg-slate-100">
                                    <Tag className="h-3 w-3 mr-1 opacity-50"/>
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 mt-auto pt-4 border-t border-dashed border-black/20">
                        <Link to={`/agents/${agent.id}/chat`} className="flex-1">
                            <Button className="w-full bg-black text-white">
                                <MessageSquare className="mr-2 h-4 w-4"/> Chat
                            </Button>
                        </Link>
                        {!isViewer && (
                          <Link to={`/agents/${agent.id}/edit`}>
                              <Button variant="outline" className="px-3"><Edit className="h-4 w-4"/></Button>
                          </Link>
                        )}
                    </div>
                </div>
            ))}
        </div>
        
        {!loading && agents.length === 0 && (
            <div className="text-center py-12 border-4 border-dashed border-black/20">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                <p className="text-lg text-muted-foreground mb-4">No agents found. Create your first AI assistant!</p>
                <Link to="/agents/new">
                    <Button variant="outline">Create Agent</Button>
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}
