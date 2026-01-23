import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, CheckCircle, ArrowLeft, Mic2 } from "lucide-react";
import { AVAILABLE_MODELS } from "@/context/ModelContext";
import { listBrandVoices, BrandVoice } from "@/lib/api-brand-voices";

export default function WorkflowRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const [workflow, setWorkflow] = useState<any>(null);
  const [inputs, setInputs] = useState<{key: string, value: string}[]>([{key: "topic", value: ""}]);
  const [execution, setExecution] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("google/gemini-2.0-flash-001");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([]);

  useEffect(() => {
    if (id) loadWorkflow();
  }, [id]);

  useEffect(() => {
    if (currentTeam) loadBrandVoices();
  }, [currentTeam]);

  const loadWorkflow = async () => {
    const { data } = await supabase.from('workflows').select('*').eq('id', id).single();
    setWorkflow(data);
  };

  const loadBrandVoices = async () => {
    try {
      const voices = await listBrandVoices();
      setBrandVoices(voices);
    } catch (e) {
      console.error('Failed to load brand voices', e);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setExecution(null);
    
    const inputPayload = inputs.reduce((acc, curr) => {
        if(curr.key) acc[curr.key] = curr.value;
        return acc;
    }, {} as any);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const user = session?.user;
        
        const res = await fetch(`/api/workflows/${id}/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-organization-id': currentTeam?.id || '',
                'x-user-id': user?.id || ''
            },
            body: JSON.stringify({ inputs: inputPayload, modelId: selectedModelId, brandVoiceId: selectedVoiceId })
        });
        
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to run');
        setExecution(data); // { success: true, results: {...} }
    } catch (e: any) {
        alert(e.message);
    } finally {
        setLoading(false);
    }
  };

  if (!workflow) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/workflows")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4"/> Back
        </Button>

        <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Configuration */}
            <div className="border-4 border-black bg-white p-8 shadow-brutal">
                <h1 className="text-3xl font-bold mb-2">{workflow.name}</h1>
                <p className="text-muted-foreground mb-8">{workflow.description}</p>
                
                <h3 className="font-bold text-lg mb-4 uppercase">Configuration</h3>
                <div className="space-y-4 mb-6">
                    <div>
                        <Label className="mb-2 block">Default Model</Label>
                        <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                            <SelectTrigger className="input-brutal bg-white">
                                <SelectValue placeholder="Select Model" />
                            </SelectTrigger>
                            <SelectContent>
                                {AVAILABLE_MODELS.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="mb-2 block flex items-center gap-2">
                            <Mic2 className="h-4 w-4" /> Brand Voice
                        </Label>
                        <Select value={selectedVoiceId || "none"} onValueChange={(val) => setSelectedVoiceId(val === "none" ? undefined : val)}>
                            <SelectTrigger className="input-brutal bg-white">
                                <SelectValue placeholder="Select Brand Voice" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Default Voice</SelectItem>
                                {brandVoices.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">AI will adapt output to match this voice</p>
                    </div>
                </div>

                <h3 className="font-bold text-lg mb-4 uppercase">Run Inputs</h3>
                <div className="space-y-3 mb-6">
                    {inputs.map((inp, i) => (
                        <div key={i} className="flex gap-2">
                            <Input placeholder="Key (e.g. topic)" value={inp.key} onChange={e => {
                                const copy = [...inputs]; copy[i].key = e.target.value; setInputs(copy);
                            }} className="w-1/3 input-brutal font-mono text-xs"/>
                            <Input placeholder="Value" value={inp.value} onChange={e => {
                                const copy = [...inputs]; copy[i].value = e.target.value; setInputs(copy);
                            }} className="flex-1 input-brutal"/>
                            <Button variant="outline" onClick={() => {
                                const copy = [...inputs]; copy.splice(i, 1); setInputs(copy);
                            }}>X</Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setInputs([...inputs, {key:"", value:""}])}>+ Add Input</Button>
                </div>

                <Button onClick={handleRun} disabled={loading} className="w-full bg-black text-white py-6 text-lg">
                    {loading ? <Loader2 className="animate-spin mr-2"/> : <Play className="mr-2"/>}
                    Start Workflow
                </Button>
            </div>

            {/* Right: Results */}
            <div className="border-4 border-black bg-slate-50 p-8 shadow-brutal min-h-[500px]">
                <h2 className="text-2xl font-bold mb-6">Execution Results</h2>
                
                {execution ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-green-600 font-bold text-lg">
                            <CheckCircle /> Execution Complete
                        </div>
                        
                        {execution.error && (
                            <div className="border-2 border-red-500 bg-red-50 p-4 text-red-700">
                                <div className="font-bold mb-2">Error:</div>
                                <p>{execution.error}</p>
                            </div>
                        )}
                        
                        {Object.entries(execution.results || {}).filter(([stepId]) => stepId !== 'initial').length === 0 && !execution.error && (
                            <div className="text-muted-foreground">No step outputs found.</div>
                        )}
                        
                        {Object.entries(execution.results || {}).map(([stepId, output]: [string, any]) => {
                            if (stepId === 'initial') return null;
                            
                            // Format output for display
                            const formatOutput = (data: any): string => {
                                if (!data) return 'No output';
                                if (typeof data === 'string') return data;
                                if (typeof data === 'object') {
                                    // Handle blog_post and similar structured outputs
                                    if (data.body) return `Title: ${data.title || 'Untitled'}\n\n${data.body}`;
                                    if (data.text) return data.text;
                                    if (Array.isArray(data)) {
                                        return data.map((item, i) => {
                                            if (typeof item === 'string') return item;
                                            if (item?.text) return item.text;
                                            if (item?.body) return `${item.title || `Item ${i+1}`}\n${item.body}`;
                                            return JSON.stringify(item, null, 2);
                                        }).join('\n\n---\n\n');
                                    }
                                    return JSON.stringify(data, null, 2);
                                }
                                return String(data);
                            };
                            
                            return (
                                <div key={stepId} className="border-2 border-black bg-white p-4">
                                    <div className="font-bold uppercase text-xs text-muted-foreground mb-2">Output from {stepId}</div>
                                    <div className="prose max-w-none">
                                        <pre className="whitespace-pre-wrap text-sm bg-muted p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
                                            {formatOutput(output)}
                                        </pre>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Play className="h-12 w-12 mb-4 opacity-20"/>
                        <p>Run the workflow to see results here</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
