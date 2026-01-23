import { useEffect, useState } from 'react';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { getCommonHeaders } from '@/lib/api';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Trash2, Edit2, Plus, Tag, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermissions } from '@/hooks/usePermissions';

interface TagModel { id: string; name: string; }

export default function TagsManager() {
  const { canEdit, isViewer } = usePermissions();
  const { toast } = useToast();
  const [tags, setTags] = useState<TagModel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTagName, setNewTagName] = useState('');
  const [editTag, setEditTag] = useState<TagModel | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadTags(); }, []);

  const loadTags = async () => {
      try {
          const res = await fetch('/api/tags', { headers: await getCommonHeaders() });
          if (res.ok) {
              const data = await res.json();
              setTags(data.tags || []);
          }
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const createTag = async () => {
      if (!canEdit) {
          toast({ title: "Access Denied", description: "Viewers cannot create tags", variant: "destructive" });
          return;
      }
      if (!newTagName.trim()) return;
      try {
          const res = await fetch('/api/tags', {
              method: 'POST',
              headers: await getCommonHeaders(),
              body: JSON.stringify({ name: newTagName, type: 'project' })
          });
          if (res.ok) {
              setNewTagName('');
              loadTags();
              toast({ title: "Tag Created" });
          }
      } catch(e) { toast({ title: "Error", description: "Failed to create tag", variant: "destructive" }); }
  };

  const updateTag = async () => {
      if (!canEdit) return;
      if (!editTag || !editName.trim()) return;
      try {
          const res = await fetch(`/api/tags/${editTag.id}`, {
              method: 'PATCH',
              headers: await getCommonHeaders(),
              body: JSON.stringify({ name: editName })
          });
          if (res.ok) {
              setEditTag(null);
              loadTags();
              toast({ title: "Tag Updated" });
          }
      } catch(e) { toast({ title: "Error", description: "Failed to update tag", variant: "destructive" }); }
  };

  const deleteTag = async (id: string) => {
      if (!canEdit) return;
      if (!confirm("Delete this tag? It will be removed from all files/projects.")) return;
      try {
          const res = await fetch(`/api/tags/${id}`, { method: 'DELETE', headers: await getCommonHeaders() });
          if (res.ok) {
              loadTags();
              toast({ title: "Tag Deleted" });
          }
      } catch(e) { toast({ title: "Error", description: "Failed to delete tag", variant: "destructive" }); }
  };

  return (
      <ToolLayout title="Tags Management" description="Organize your workspace with tags">
          <div className="max-w-3xl mx-auto">
              <div className="bg-white border-4 border-black p-6 shadow-brutal mb-8">
                  {isViewer && (
                    <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                      <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You can only view tags, not manage them</p>
                    </div>
                  )}
                  <h3 className="font-bold text-lg mb-4">Create New Tag</h3>
                  <div className="flex gap-2">
                      <Input 
                        placeholder="Tag Name (e.g. Urgent, Marketing)" 
                        value={newTagName} 
                        onChange={e => setNewTagName(e.target.value)}
                        disabled={isViewer}
                      />
                      <Button 
                        onClick={createTag}
                        disabled={isViewer}
                        className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                        title={isViewer ? 'Viewers cannot create tags' : ''}
                      ><Plus className="mr-2 h-4 w-4"/> Create</Button>
                  </div>
              </div>

              <div className="space-y-2">
                  {tags.map(tag => (
                      <div key={tag.id} className="bg-white border-2 border-black p-4 flex justify-between items-center hover:shadow-brutal transition-all">
                          <div className="flex items-center gap-3">
                              <Tag className="h-5 w-5 text-pink-500"/>
                              <span className="font-bold">{tag.name}</span>
                          </div>
                          <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => { setEditTag(tag); setEditName(tag.name); }}
                                disabled={isViewer}
                                className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                              >
                                  <Edit2 className="h-4 w-4"/>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => deleteTag(tag.id)}
                                disabled={isViewer}
                                className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                              >
                                  <Trash2 className="h-4 w-4"/>
                              </Button>
                          </div>
                      </div>
                  ))}
                  {tags.length === 0 && !loading && <p className="text-center text-muted-foreground">No tags found.</p>}
              </div>
          </div>

          <Dialog open={!!editTag} onOpenChange={(o) => !o && setEditTag(null)}>
              <DialogContent>
                  <DialogHeader><DialogTitle>Edit Tag</DialogTitle></DialogHeader>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} />
                  <DialogFooter><Button onClick={updateTag}>Save</Button></DialogFooter>
              </DialogContent>
          </Dialog>
      </ToolLayout>
  );
}
