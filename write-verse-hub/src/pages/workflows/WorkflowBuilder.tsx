import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { TagSelector } from "@/components/TagSelector";

const EXAMPLE_STEPS = [
  {
    "id": "step1",
    "tool": "blog_post",
    "params": {
      "audience": "tech founders",
      "tone": "professional"
    },
    "input_map": {
      "topic": "{{initial.topic}}" 
    }
  },
  {
    "id": "step2",
    "tool": "linkedin",
    "params": {
      "tone": "educational"
    },
    "input_map": {
      "topic": "{{step1.body}}" 
    }
  }
];

export default function WorkflowBuilder() {
  const { id } = useParams(); // if editing
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stepsJson, setStepsJson] = useState(JSON.stringify(EXAMPLE_STEPS, null, 2));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && currentTeam) loadWorkflow();
  }, [id, currentTeam]);

  const loadWorkflow = async () => {
    const { data } = await supabase.from('workflows').select('*').eq('id', id).single();
    if (data) {
      setName(data.name);
      setDescription(data.description || "");
      setStepsJson(JSON.stringify(data.steps, null, 2));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return alert("Name is required");
    let steps;
    try {
      steps = JSON.parse(stepsJson);
    } catch (e) {
      return alert("Invalid JSON in steps configuration");
    }

    setSaving(true);
    const payload = {
      organization_id: currentTeam?.id,
      name,
      description,
      steps,
      updated_at: new Date().toISOString()
    };

    let error;
    if (id) {
       ({ error } = await supabase.from('workflows').update(payload).eq('id', id));
    } else {
       ({ error } = await supabase.from('workflows').insert(payload));
    }

    setSaving(false);
    if (error) alert("Error saving: " + error.message);
    else navigate("/workflows");
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/workflows")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4"/> Back to Workflows
        </Button>
        
        <div className="max-w-4xl mx-auto border-4 border-black bg-white p-8 shadow-brutal-lg">
            <h1 className="text-3xl font-bold mb-6">{id ? 'Edit Workflow' : 'New Workflow'}</h1>
            
            <div className="space-y-6">
                <div>
                    <Label>Workflow Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="input-brutal font-bold text-lg" placeholder="e.g. Content Machine"/>
                </div>
                
                <div>
                    <Label>Description</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} className="input-brutal" placeholder="What does this workflow do?"/>
                </div>

                {id && currentTeam && (
                    <div>
                        <Label className="mb-2 block">Tags</Label>
                        <TagSelector 
                            entityId={id} 
                            entityType="workflow" 
                            organizationId={currentTeam.id} 
                        />
                    </div>
                )}

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <Label>Steps Configuration (JSON)</Label>
                        <span className="text-xs text-muted-foreground">Define steps array with tool inputs and variable mapping</span>
                    </div>
                    <Textarea 
                        value={stepsJson} 
                        onChange={e => setStepsJson(e.target.value)} 
                        className="font-mono text-sm input-brutal bg-slate-50"
                        rows={20}
                    />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full bg-black text-white py-6 text-lg">
                    {saving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                    Save Workflow
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
