import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeam } from '@/context/TeamContext';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { listTemplates, deleteTemplate, ContentTemplate } from '@/lib/api-templates';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, Play, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Templates() {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const isViewer = currentTeam?.role === 'viewer';
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Delete template?')) return;
    try {
      await deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
      toast({ title: "Deleted" });
    } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  return (
    <ToolLayout title="Custom Templates" description="Create and manage your own AI tools">
      <div className="mb-6 flex justify-end">
        <Button onClick={() => navigate('/templates/new')} disabled={isViewer} className="border-2 border-black shadow-brutal">
          <Plus className="mr-2 h-4 w-4"/> Create Template
        </Button>
      </div>

      {loading ? <div>Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map(t => (
            <Card key={t.id} className="border-2 border-black shadow-brutal hover:shadow-brutal-lg transition-all">
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription className="line-clamp-2">{t.description}</CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-between bg-muted/20 py-3">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled={isViewer} onClick={() => navigate(`/templates/${t.id}/edit`)}><Pencil className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="sm" disabled={isViewer} onClick={() => handleDelete(t.id)} className="text-red-600"><Trash2 className="h-4 w-4"/></Button>
                </div>
                <Button size="sm" onClick={() => navigate(`/templates/${t.id}/run`)} className="border-2 border-black bg-green-400 hover:bg-green-500 text-black font-bold">
                  <Play className="mr-2 h-4 w-4"/> Run
                </Button>
              </CardFooter>
            </Card>
          ))}
          {templates.length === 0 && (
            <div className="col-span-3 text-center p-10 border-2 border-dashed border-gray-300 rounded">
              <p className="text-muted-foreground">No custom templates yet. Create one to get started!</p>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
}
