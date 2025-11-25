import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { TagSelector } from "@/components/TagSelector";

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentTeam) {
        loadFiles();
    }
    if (id && currentTeam) loadAgent();
  }, [id, currentTeam]);

  const loadFiles = async () => {
      const { data } = await supabase.from('knowledge_files')
        .select('*')
        .eq('organization_id', currentTeam?.id)
        .order('created_at', { ascending: false });
      setAvailableFiles(data || []);
  };

  const loadAgent = async () => {
    const { data } = await supabase.from('agents').select('*').eq('id', id).single();
    if (data) {
      setName(data.name);
      setDescription(data.description || "");
      setInstructions(data.instructions);
      setSelectedFiles(data.knowledge_file_ids || []);
    }
  };

  const handleFileToggle = (fileId: string) => {
      setSelectedFiles(prev => 
        prev.includes(fileId) 
          ? prev.filter(id => id !== fileId)
          : [...prev, fileId]
      );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (text) {
              setInstructions(prev => {
                  const separator = prev ? "\n\n" : "";
                  return prev + separator + `### Context from ${file.name}:\n` + text;
              });
              toast.success(`Added content from ${file.name}`);
          }
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!instructions.trim()) return toast.error("Instructions are required");

    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      organization_id: currentTeam?.id,
      name,
      description,
      instructions,
      knowledge_file_ids: selectedFiles, // Save selected files
      created_by: user?.id, // Important for RLS
      updated_at: new Date().toISOString()
    };

    let error;
    if (id) {
       ({ error } = await supabase.from('agents').update(payload).eq('id', id));
    } else {
       ({ error } = await supabase.from('agents').insert(payload));
    }

    setSaving(false);
    if (error) {
        if (error.code === '23505') {
            toast.error("An agent with this name already exists.");
        } else {
            toast.error(error.message);
        }
    } else {
        toast.success("Agent saved!");
        navigate("/agents");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/agents")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4"/> Back
        </Button>
        
        <div className="max-w-3xl mx-auto border-4 border-black bg-white p-8 shadow-brutal-lg">
            <h1 className="text-3xl font-bold mb-6">{id ? 'Edit Agent' : 'New Agent'}</h1>
            
            <div className="space-y-6">
                <div>
                    <Label>Agent Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="input-brutal font-bold text-lg" placeholder="e.g. Legal Advisor"/>
                </div>
                
                <div>
                    <Label>Description</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} className="input-brutal" placeholder="Short description of what this agent does"/>
                </div>
                
                {id && currentTeam && (
                    <div>
                        <Label className="mb-2 block">Tags</Label>
                        <TagSelector 
                            entityId={id} 
                            entityType="agent" 
                            organizationId={currentTeam.id} 
                        />
                    </div>
                )}

                {/* Knowledge Base Selection */}
                <div className="border-2 border-black p-4 bg-slate-50">
                    <Label className="mb-2 block">Knowledge Context</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                        Select which Knowledge Base files this agent can access.
                    </p>
                    {availableFiles.length === 0 ? (
                        <p className="text-sm italic text-gray-500">No knowledge files found. Upload some in Settings {'>'} Knowledge Base.</p>
                    ) : (
                        <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 p-2 bg-white">
                            {availableFiles.map(file => (
                                <div key={file.id} className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id={`file-${file.id}`}
                                        checked={selectedFiles.includes(file.id)}
                                        onChange={() => handleFileToggle(file.id)}
                                        className="h-4 w-4 border-2 border-black rounded-none accent-black"
                                    />
                                    <label htmlFor={`file-${file.id}`} className="text-sm cursor-pointer select-none truncate">
                                        {file.title} <span className="text-xs text-gray-400">({new Date(file.created_at).toLocaleDateString()})</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div>
                    <Label>Knowledge Source (Optional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Upload a text file (.txt, .md, .csv, .json) to append its content to the System Instructions.
                    </p>
                    <div className="flex gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden"
                            accept=".txt,.md,.csv,.json"
                            onChange={handleFileUpload}
                        />
                        <Button 
                            variant="outline" 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full border-dashed"
                        >
                            <Upload className="mr-2 h-4 w-4"/> Import File to Instructions
                        </Button>
                    </div>
                </div>

                <div>
                    <Label>System Instructions</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Define the agent's persona, tone, and rules. The agent will automatically have access to your Knowledge Base.
                    </p>
                    <Textarea 
                        value={instructions} 
                        onChange={e => setInstructions(e.target.value)} 
                        className="font-mono text-sm input-brutal min-h-[300px]"
                        placeholder="You are a helpful assistant. You always answer in bullet points. You prioritize information from the knowledge base."
                    />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full bg-black text-white py-6 text-lg">
                    {saving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                    Save Agent
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
