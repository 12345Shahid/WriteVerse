import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { getProject, listTasks, createTask, updateTask, deleteTask, listTaskAssets, attachAsset, detachAsset, updateProject, Project, Task } from '@/lib/api-projects';
import { getCommonHeaders } from '@/lib/api';
import { Loader2, ArrowLeft, ArrowRight, Check, Trash2, Pencil, X, Paperclip, Plus, File as FileIcon, Tag, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TagModel { id: string; name: string; color: string; }

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  // Metadata
  const [allTags, setAllTags] = useState<TagModel[]>([]);
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Task Details Dialog (Attachments & Tags)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskAssets, setTaskAssets] = useState<any[]>([]);
  const [isTaskDetailsLoading, setIsTaskDetailsLoading] = useState(false);

  // Project Files Dialog
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [projectAssets, setProjectAssets] = useState<any[]>([]);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (projectId: string) => {
    try {
      const headers = await getCommonHeaders();
      const [p, t, tagRes, assetRes] = await Promise.all([
          getProject(projectId), 
          listTasks(projectId),
          fetch('/api/tags', { headers }),
          fetch('/api/assets', { headers })
      ]);
      
      setProject(p);
      setTasks(t);
      
      if (tagRes.ok) {
          const d = await tagRes.json();
          setAllTags(d.tags || []);
      }
      if (assetRes.ok) {
          const d = await assetRes.json();
          setAvailableAssets(d.assets || []);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load project data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (status: Task['status'] = 'todo') => {
    if (!id || !newTaskTitle.trim()) return;
    const title = newTaskTitle;
    setNewTaskTitle(''); 
    try {
        const t = await createTask(id, { title, status });
        setTasks([...tasks, t]);
    } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    }
  };
  
  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
      const oldTasks = [...tasks];
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      
      try {
          await updateTask(taskId, { status: newStatus });
      } catch (e) {
          console.error(e);
          setTasks(oldTasks); 
          toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
      }
  };

  const handleDelete = async (taskId: string) => {
      if(!confirm('Delete this task?')) return;
      const old = [...tasks];
      setTasks(tasks.filter(t => t.id !== taskId));
      try {
          await deleteTask(taskId);
          toast({ title: "Deleted", description: "Task removed" });
      } catch(e) {
          setTasks(old);
          toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
      }
  };

  const startEditing = (task: Task) => {
      setEditingTaskId(task.id);
      setEditTitle(task.title);
  };

  const saveEdit = async () => {
      if (!editingTaskId || !editTitle.trim()) return;
      const taskId = editingTaskId;
      const old = [...tasks];
      setTasks(tasks.map(t => t.id === taskId ? {...t, title: editTitle} : t));
      setEditingTaskId(null);
      try {
          await updateTask(taskId, { title: editTitle });
      } catch(e) {
          setTasks(old);
          toast({ title: "Error", description: "Failed to update", variant: "destructive" });
      }
  };

  // --- Task Details (Tags & Attachments) ---

  const openTaskDetails = async (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailsLoading(true);
    try {
        const tAssets = await listTaskAssets(task.id);
        setTaskAssets(tAssets);
    } catch (e) { console.error(e); }
    finally { setIsTaskDetailsLoading(false); }
  };

  const handleTaskAttachFile = async (assetId: string) => {
      if (!selectedTask) return;
      if (taskAssets.find(a => a.id === assetId)) return;
      try {
          await attachAsset(selectedTask.id, assetId);
          setTaskAssets([...taskAssets, availableAssets.find(a => a.id === assetId)]);
          toast({ title: "File Attached" });
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleTaskDetachFile = async (assetId: string) => {
      if (!selectedTask) return;
      try {
          await detachAsset(selectedTask.id, assetId);
          setTaskAssets(taskAssets.filter(a => a.id !== assetId));
          toast({ title: "File Detached" });
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleTaskAddTag = async (tagId: string) => {
      if (!selectedTask) return;
      // @ts-ignore
      if (selectedTask.tags?.some(t => t.id === tagId)) return;
      try {
          const headers = await getCommonHeaders();
          const res = await fetch(`/api/tasks/${selectedTask.id}/tags`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ tagId })
          });
          if (res.ok) {
              const tag = allTags.find(t => t.id === tagId);
              if (tag) {
                  const newTags = [...(selectedTask.tags || []), tag];
                  const updatedTask = { ...selectedTask, tags: newTags };
                  setSelectedTask(updatedTask);
                  setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
                  toast({ title: "Tag Added" });
              }
          }
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleTaskRemoveTag = async (tagId: string) => {
      if (!selectedTask) return;
      try {
          const headers = await getCommonHeaders();
          const res = await fetch(`/api/tasks/${selectedTask.id}/tags/${tagId}`, {
              method: 'DELETE',
              headers
          });
          if (res.ok) {
              const newTags = (selectedTask.tags || []).filter((t: any) => t.id !== tagId);
              const updatedTask = { ...selectedTask, tags: newTags };
              setSelectedTask(updatedTask);
              setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
              toast({ title: "Tag Removed" });
          }
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  // --- Project Files ---

  const openProjectFiles = async () => {
      setShowProjectFiles(true);
      if (!id) return;
      try {
          const headers = await getCommonHeaders();
          const res = await fetch(`/api/projects/${id}/assets`, { headers });
          if (res.ok) {
              const data = await res.json();
              setProjectAssets(data.assets || []);
          }
      } catch(e) { console.error(e); }
  };

  const handleProjectAttachFile = async (assetId: string) => {
      if (!id) return;
      if (projectAssets.find(a => a.id === assetId)) return;
      try {
          const headers = await getCommonHeaders();
          const res = await fetch(`/api/projects/${id}/assets`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ assetId })
          });
          if (res.ok) {
              setProjectAssets([...projectAssets, availableAssets.find(a => a.id === assetId)]);
              toast({ title: "File Attached to Project" });
          }
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleProjectDetachFile = async (assetId: string) => {
      if (!id) return;
      try {
          const headers = await getCommonHeaders();
          const res = await fetch(`/api/projects/${id}/assets/${assetId}`, {
              method: 'DELETE',
              headers
          });
          if (res.ok) {
              setProjectAssets(projectAssets.filter(a => a.id !== assetId));
              toast({ title: "File Detached from Project" });
          }
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleProjectStatusChange = async (newStatus: 'active' | 'archived' | 'completed') => {
    if (!project) return;
    const old = { ...project };
    setProject({ ...project, status: newStatus });
    try {
      await updateProject(project.id, { status: newStatus });
      toast({ title: "Project Status Updated" });
    } catch (e) {
      setProject(old);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };


  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
  if (!project) return <div className="p-10 text-center">Project not found</div>;

  const renderColumn = (title: string, status: Task['status']) => (
      <div className="flex-1 min-w-[300px] bg-muted/30 border-4 border-black p-4 flex flex-col gap-4 h-[calc(100vh-200px)] overflow-y-auto">
          <div className="flex items-center justify-between border-b-4 border-black pb-2 mb-2 bg-white p-2 sticky top-0 z-10">
              <h3 className="font-black uppercase text-lg">{title}</h3>
              <span className="bg-black text-white text-xs px-2 py-1 rounded-full font-bold">
                {tasks.filter(t => t.status === status).length}
              </span>
          </div>
          
          {tasks.filter(t => t.status === status).map(t => (
              <div key={t.id} className="bg-white border-2 border-black p-3 shadow-brutal-sm group hover:shadow-brutal transition-all">
                  {editingTaskId === t.id ? (
                    <div className="flex gap-2 mb-2">
                        <Input 
                            value={editTitle} 
                            onChange={e => setEditTitle(e.target.value)} 
                            className="h-8" 
                            autoFocus 
                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        />
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={saveEdit}><Check className="h-4 w-4"/></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => setEditingTaskId(null)}><X className="h-4 w-4"/></Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-bold">{t.title}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditing(t)}><Pencil className="h-3 w-3"/></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-red-600" onClick={() => handleDelete(t.id)}><Trash2 className="h-3 w-3"/></Button>
                        </div>
                    </div>
                  )}
                  
                  {/* Tags Display */}
                  {/* @ts-ignore */}
                  {t.tags && t.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                          {/* @ts-ignore */}
                          {t.tags.map(tag => (
                              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded bg-black text-white">{tag.name}</span>
                          ))}
                      </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-2">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-black" onClick={() => openTaskDetails(t)} title="Details">
                          <FolderOpen className="h-3 w-3"/>
                      </Button>
                      
                      <div className="flex gap-2 justify-end opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {status === 'todo' && (
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleStatusChange(t.id, 'in_progress')}><ArrowRight className="h-3 w-3"/></Button>
                        )}
                        {status === 'in_progress' && (
                            <>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleStatusChange(t.id, 'todo')}><ArrowLeft className="h-3 w-3"/></Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleStatusChange(t.id, 'review')}><ArrowRight className="h-3 w-3"/></Button>
                            </>
                        )}
                        {status === 'review' && (
                            <>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleStatusChange(t.id, 'in_progress')}><ArrowLeft className="h-3 w-3"/></Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleStatusChange(t.id, 'done')}><Check className="h-3 w-3"/></Button>
                            </>
                        )}
                        {status === 'done' && (
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleStatusChange(t.id, 'in_progress')}><ArrowLeft className="h-3 w-3"/></Button>
                        )}
                      </div>
                  </div>
              </div>
          ))}

          {status === 'todo' && (
              <div className="mt-2 pt-2 border-t-2 border-dashed border-black">
                  <Input 
                    placeholder="Add task..." 
                    value={newTaskTitle} 
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                    className="bg-white border-2 border-black mb-2 h-10"
                  />
                  <Button size="sm" onClick={() => handleCreateTask()} className="w-full" disabled={!newTaskTitle.trim()}>Add Task</Button>
              </div>
          )}
      </div>
  );

  return (
    <ToolLayout title={project.name} description={project.description || "Project Board"}>
        <div className="mb-6 flex flex-col md:flex-row justify-between gap-4 items-center">
            <div className="flex gap-2 items-center">
                <Button variant="outline" onClick={() => navigate('/projects')} className="border-2 border-black">
                    <ArrowLeft className="mr-2 h-4 w-4"/> Back
                </Button>
                
                <Select value={project.status} onValueChange={(v: any) => handleProjectStatusChange(v)}>
                    <SelectTrigger className="w-[150px] border-2 border-black font-bold bg-white">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">ACTIVE</SelectItem>
                        <SelectItem value="completed">COMPLETED</SelectItem>
                        <SelectItem value="archived">ARCHIVED</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button variant="outline" onClick={openProjectFiles} className="border-2 border-black">
                <Paperclip className="mr-2 h-4 w-4"/> Project Files
            </Button>
        </div>
        
        <div className="flex overflow-x-auto gap-4 pb-4 min-h-[500px]">
            {renderColumn("To Do", 'todo')}
            {renderColumn("In Progress", 'in_progress')}
            {renderColumn("Review", 'review')}
            {renderColumn("Done", 'done')}
        </div>

        {/* Task Details Dialog */}
        <Dialog open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Task Details: {selectedTask?.title}</DialogTitle></DialogHeader>
                
                <Tabs defaultValue="files">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="files">Files</TabsTrigger>
                        <TabsTrigger value="tags">Tags</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="files">
                        {isTaskDetailsLoading ? <Loader2 className="animate-spin mx-auto"/> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border-r border-gray-200 pr-4">
                                    <h4 className="font-bold mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4"/> Attached Files</h4>
                                    {taskAssets.length === 0 && <p className="text-sm text-muted-foreground">No attachments.</p>}
                                    <div className="space-y-2">
                                        {taskAssets.map(asset => (
                                            <div key={asset.id} className="flex justify-between items-center bg-muted p-2 rounded border">
                                                <span className="text-sm truncate max-w-[150px]">{asset.name}</span>
                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => handleTaskDetachFile(asset.id)}><X className="h-3 w-3"/></Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2"><Plus className="h-4 w-4"/> Add File</h4>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {availableAssets.map(asset => {
                                            const isAttached = taskAssets.some(a => a.id === asset.id);
                                            return (
                                                <div key={asset.id} className="flex justify-between items-center border p-2 rounded hover:bg-accent">
                                                    <span className="text-sm truncate max-w-[150px]">{asset.name}</span>
                                                    <Button size="sm" variant={isAttached ? "secondary" : "default"} className="h-6 px-2 text-xs" disabled={isAttached} onClick={() => handleTaskAttachFile(asset.id)}>{isAttached ? "Added" : "Add"}</Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                    
                    <TabsContent value="tags">
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                {selectedTask?.tags?.map(tag => (
                                    <span key={tag.id} className="bg-black text-white px-2 py-1 rounded flex items-center gap-1 text-sm">
                                        {tag.name}
                                        <X className="h-3 w-3 cursor-pointer hover:text-red-400" onClick={() => handleTaskRemoveTag(tag.id)}/>
                                    </span>
                                ))}
                                {/* @ts-ignore */}
                                {(!selectedTask?.tags || selectedTask.tags.length === 0) && <span className="text-muted-foreground text-sm">No tags assigned.</span>}
                            </div>
                            <div className="pt-4 border-t">
                                <h4 className="font-bold mb-2">Available Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    {allTags.filter(t => !selectedTask?.tags?.some(existing => existing.id === t.id)).map(tag => (
                                        <Button key={tag.id} size="sm" variant="outline" onClick={() => handleTaskAddTag(tag.id)} className="h-6 text-xs">
                                            <Plus className="mr-1 h-3 w-3"/> {tag.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setSelectedTask(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Project Files Dialog */}
        <Dialog open={showProjectFiles} onOpenChange={setShowProjectFiles}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Project Files</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border-r border-gray-200 pr-4">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4"/> Attached to Project</h4>
                        {projectAssets.length === 0 && <p className="text-sm text-muted-foreground">No files attached.</p>}
                        <div className="space-y-2">
                            {projectAssets.map(asset => (
                                <div key={asset.id} className="flex justify-between items-center bg-muted p-2 rounded border">
                                    <span className="text-sm truncate max-w-[150px]">{asset.name}</span>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => handleProjectDetachFile(asset.id)}><X className="h-3 w-3"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Plus className="h-4 w-4"/> Add File</h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {availableAssets.map(asset => {
                                const isAttached = projectAssets.some(a => a.id === asset.id);
                                return (
                                    <div key={asset.id} className="flex justify-between items-center border p-2 rounded hover:bg-accent">
                                        <span className="text-sm truncate max-w-[150px]">{asset.name}</span>
                                        <Button size="sm" variant={isAttached ? "secondary" : "default"} className="h-6 px-2 text-xs" disabled={isAttached} onClick={() => handleProjectAttachFile(asset.id)}>{isAttached ? "Added" : "Add"}</Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowProjectFiles(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </ToolLayout>
  );
}
