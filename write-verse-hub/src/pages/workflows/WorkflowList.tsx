import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button-brutal";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Edit, Tag } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";

export default function WorkflowList() {
  const { currentTeam } = useTeam();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentTeam) loadWorkflows();
  }, [currentTeam]);

  const loadWorkflows = async () => {
    const { data } = await supabase
      .from('workflows')
      .select('*, tags:workflow_tags(tag:tags(*))')
      .eq('organization_id', currentTeam?.id)
      .order('created_at', { ascending: false });
    
    const formatted = data?.map(w => ({
        ...w,
        tags: w.tags?.map((t: any) => t.tag) || []
    })) || [];

    setWorkflows(formatted);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Workflows (Beta)</h1>
          <Link to="/workflows/new">
            <Button className="bg-black text-white">
              <Plus className="mr-2 h-4 w-4" /> New Workflow
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map(w => (
                <div key={w.id} className="border-4 border-black bg-card p-6 shadow-brutal hover:translate-x-1 hover:-translate-y-1 transition-transform flex flex-col">
                    <h3 className="text-xl font-bold mb-2">{w.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-1">{w.description || 'No description'}</p>
                    
                    {/* Tags Display */}
                    {w.tags && w.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {w.tags.map((tag: any) => (
                                <Badge key={tag.id} variant="secondary" className="text-xs font-normal border border-black/20 bg-slate-100">
                                    <Tag className="h-3 w-3 mr-1 opacity-50"/>
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 mt-auto pt-4 border-t border-dashed border-black/20">
                        <Link to={`/workflows/${w.id}/run`} className="flex-1">
                            <Button className="w-full bg-black text-white"><Play className="mr-2 h-4 w-4"/> Run</Button>
                        </Link>
                        <Link to={`/workflows/${w.id}/edit`}>
                            <Button variant="outline" className="px-3"><Edit className="h-4 w-4"/></Button>
                        </Link>
                    </div>
                </div>
            ))}
        </div>
        
        {!loading && workflows.length === 0 && (
            <div className="text-center py-12 border-4 border-dashed border-black/20">
                <p className="text-lg text-muted-foreground mb-4">No workflows found. Create your first automation chain!</p>
                <Link to="/workflows/new">
                    <Button variant="outline">Create Workflow</Button>
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}
