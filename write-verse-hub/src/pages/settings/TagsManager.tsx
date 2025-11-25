import { useEffect, useState } from 'react';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { getCommonHeaders } from '@/lib/api';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Trash2, Edit2, Plus, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TagModel { id: string; name: string; }

export default function TagsManager() {
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
      if (!newTagName.trim()) return;
      try {
          const res = await fetch('/api/tags', {
              method: 'POST',
              headers: await getCommonHeaders(),
              body: JSON.stringify({ name: newTagName })
          });
          if (res.ok) {
              setNewTagName('');
              loadTags();
              toast({ title: "Tag Created" });
          }
      } catch(e) { toast({ title: "Error", description: "Failed to create tag", variant: "destructive" }); }
  };

  const updateTag = async () => {
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
                  <h3 className="font-bold text-lg mb-4">Create New Tag</h3>
                  <div className="flex gap-2">
                      <Input placeholder="Tag Name (e.g. Urgent, Marketing)" value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                      <Button onClick={createTag}><Plus className="mr-2 h-4 w-4"/> Create</Button>
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
                              <Button size="sm" variant="outline" onClick={() => { setEditTag(tag); setEditName(tag.name); }}>
                                  <Edit2 className="h-4 w-4"/>
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteTag(tag.id)}>
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
