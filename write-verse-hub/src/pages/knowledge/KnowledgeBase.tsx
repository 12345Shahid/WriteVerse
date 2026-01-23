import { useEffect, useState, useRef } from "react";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, Trash, Search, Paperclip, Lock } from "lucide-react";
import { toast } from "sonner";
import { TagSelector } from "@/components/TagSelector";
import { usePermissions } from "@/hooks/usePermissions";

export default function KnowledgeBase() {
  const { canEdit, isViewer } = usePermissions();
  const { currentTeam } = useTeam();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // New Doc Form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showForm, setShowForm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentTeam) loadFiles();
  }, [currentTeam]);

  const loadFiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('knowledge_files') // Fetch files, not chunks
      .select('*')
      .eq('organization_id', currentTeam?.id)
      .order('created_at', { ascending: false });
    setFiles(data || []);
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setTitle(file.name);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (text) setContent(text);
      };
      reader.readAsText(file);
  };

  const handleIngest = async () => {
    if (!canEdit) {
      toast.error('Viewers cannot add documents');
      return;
    }
    if (!title.trim() || !content.trim()) return toast.error("Title and Content required");
    
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knowledge/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-organization-id': currentTeam?.id || '',
          'x-user-id': session?.user?.id || ''
        },
        body: JSON.stringify({ title, text: content })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to upload');
      
      toast.success(`Uploaded successfully! Created ${json.chunks} chunks.`);
      setTitle("");
      setContent("");
      setShowForm(false);
      loadFiles();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) {
      toast.error('Viewers cannot delete documents');
      return;
    }
    if(!confirm("Delete this file and all its knowledge chunks?")) return;
    const { error } = await supabase.from('knowledge_files').delete().eq('id', id);
    if(error) toast.error(error.message);
    else {
        toast.success("Deleted file");
        loadFiles();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
              <h1 className="text-3xl font-bold">Knowledge Base (RAG)</h1>
              <p className="text-muted-foreground">Upload facts, guidelines, and context for your AI agents.</p>
          </div>
          {isViewer ? (
            <div className="bg-yellow-50 border-2 border-yellow-400 p-3 rounded flex items-center gap-2">
              <Lock className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-700 font-medium">Viewers can only add tags to documents</p>
            </div>
          ) : (
            <Button className="bg-black text-white" onClick={() => setShowForm(!showForm)}>
              <Upload className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Knowledge'}
            </Button>
          )}
        </div>

        {showForm && (
            <div className="border-4 border-black bg-white p-6 shadow-brutal mb-8 animate-in fade-in slide-in-from-top-4 max-w-2xl mx-auto">
                <h3 className="font-bold text-xl mb-4">Add New Document</h3>
                <div className="space-y-4">
                    <div>
                        <Label>Import File</Label>
                        <div className="flex gap-2 mt-1">
                             <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden"
                                accept=".txt,.md,.csv,.json"
                                onChange={handleFileUpload}
                            />
                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full border-dashed">
                                <Paperclip className="mr-2 h-4 w-4"/> Select Text File (.txt, .md, .json)
                            </Button>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-muted-foreground">Or paste text</span>
                        </div>
                    </div>

                    <div>
                        <Label>Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} className="input-brutal" placeholder="e.g. Brand Guidelines 2024"/>
                    </div>
                    <div>
                        <Label>Content</Label>
                        <Textarea 
                            value={content} 
                            onChange={e => setContent(e.target.value)} 
                            className="input-brutal min-h-[200px]" 
                            placeholder="Paste your document text here..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Text will be automatically chunked and embedded for semantic search.
                        </p>
                    </div>
                    <Button onClick={handleIngest} disabled={uploading} className="bg-black text-white w-full">
                        {uploading ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2 h-4 w-4"/>}
                        Ingest Document
                    </Button>
                </div>
            </div>
        )}

        {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8"/></div>
        ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {files.map(file => (
                    <div key={file.id} className="border-2 border-black bg-card p-4 shadow-brutal-sm hover:translate-x-1 hover:-translate-y-1 transition-transform relative group">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(file.id)} 
                              disabled={isViewer}
                              className={`text-red-500 h-8 w-8 p-0 ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={isViewer ? 'Viewers cannot delete documents' : 'Delete document'}
                            >
                                <Trash className="h-4 w-4"/>
                            </Button>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-yellow-300 p-2 border border-black">
                                <FileText className="h-5 w-5 text-black"/>
                            </div>
                            <h3 className="font-bold truncate pr-6" title={file.title}>{file.title}</h3>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground flex justify-between">
                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Ready</span>
                        </div>
                        <div className="mt-3 border-t border-gray-200 pt-2">
                             <TagSelector 
                                entityId={file.id} 
                                entityType="knowledge_file" 
                                organizationId={currentTeam?.id || ''} 
                             />
                        </div>
                    </div>
                ))}
                {files.length === 0 && !showForm && (
                    <div className="col-span-full text-center py-12 border-4 border-dashed border-muted">
                        <p className="text-muted-foreground">No documents found. Upload some text to get started!</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
