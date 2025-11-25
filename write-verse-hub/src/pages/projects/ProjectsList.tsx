import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeam } from '@/context/TeamContext';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Button } from '@/components/ui/button-brutal';
import { listProjects, createProject, Project } from '@/lib/api-projects';
import { Loader2, Plus, Folder } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

export default function ProjectsList() {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const isViewer = currentTeam?.role === 'viewer';
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await createProject(newName, '');
      setProjects([p, ...projects]);
      setNewName('');
      toast({ title: 'Project Created', description: `Created ${p.name}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ToolLayout title="Projects" description="Manage your content projects">
      <div className="space-y-6">
        {/* Create Bar */}
        <div className={`bg-white border-4 border-black p-4 shadow-brutal flex gap-2 max-w-xl ${isViewer ? 'opacity-50' : ''}`}>
          <Input 
            placeholder="New Project Name..." 
            value={newName} 
            onChange={e => setNewName(e.target.value)}
            className="border-2 border-black"
            disabled={isViewer}
          />
          <Button onClick={handleCreate} disabled={creating || !newName.trim() || isViewer}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Create
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-10"><Loader2 className="animate-spin mx-auto h-10 w-10" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-10 bg-muted border-4 border-black border-dashed">
            <p className="font-bold text-lg text-muted-foreground">No projects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map(p => (
              <div 
                key={p.id} 
                onClick={() => navigate(`/projects/${p.id}`)}
                className="bg-white border-4 border-black p-6 shadow-brutal hover:translate-x-1 hover:-translate-y-1 transition-transform cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Folder className="h-8 w-8" />
                  <h3 className="text-xl font-black uppercase truncate">{p.name}</h3>
                </div>
                <div className="text-sm font-bold text-muted-foreground">
                  {(p.tasks?.[0] as any)?.count ?? 0} Tasks
                </div>
                <div className="mt-4 text-xs bg-muted p-1 inline-block border border-black font-bold uppercase">
                    {p.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
