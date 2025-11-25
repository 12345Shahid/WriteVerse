import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { createTemplate, updateTemplate, listTemplates, ContentTemplate, TemplateField } from '@/lib/api-templates';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function TemplateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if(id) load(id);
  }, [id]);

  const load = async (templateId: string) => {
    try {
        // Ideally we have getTemplate(id), but list works for now
        const all = await listTemplates(); 
        const found = all.find(t => t.id === templateId);
        if (found) {
            setName(found.name);
            setDesc(found.description || '');
            setFields(found.schema || []);
            setPrompt(found.prompt_text);
        }
    } catch(e) { console.error(e); }
  };

  const addField = () => {
    setFields([...fields, { key: '', label: '', type: 'text' }]);
  };

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if(!name || !prompt) return toast({title: "Missing fields", variant: "destructive"});
    setLoading(true);
    try {
        const payload = { name, description: desc, schema: fields, prompt_text: prompt };
        if (id) {
            await updateTemplate(id, payload);
            toast({ title: "Updated" });
        } else {
            await createTemplate(payload);
            toast({ title: "Created" });
            navigate('/templates');
        }
    } catch(e) {
        toast({ title: "Error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <ToolLayout title={id ? "Edit Template" : "Create Template"} description="Define your custom tool logic">
        <div className="mb-6">
            <Button variant="outline" onClick={() => navigate('/templates')} className="border-2 border-black"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="font-bold text-sm">Name</label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. LinkedIn Viral Post"/>
                        </div>
                        <div>
                            <label className="font-bold text-sm">Description</label>
                            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description"/>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-black shadow-brutal">
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>Input Fields</CardTitle>
                        <Button size="sm" onClick={addField} className="border-2 border-black"><Plus className="h-4 w-4"/></Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fields.map((field, idx) => (
                            <div key={idx} className="p-3 bg-muted/30 border border-black/20 rounded space-y-2 relative">
                                <Button variant="ghost" size="sm" className="absolute top-1 right-1 text-red-500 h-6 w-6 p-0" onClick={() => removeField(idx)}><Trash2 className="h-3 w-3"/></Button>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold">Label</label>
                                        <Input value={field.label} onChange={e => updateField(idx, {label: e.target.value})} placeholder="e.g. Product Name" className="h-8"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold">Variable Key</label>
                                        <Input value={field.key} onChange={e => updateField(idx, {key: e.target.value})} placeholder="e.g. product_name" className="h-8 font-mono"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold">Type</label>
                                    <Select value={field.type} onValueChange={(v: any) => updateField(idx, {type: v})}>
                                        <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text">Short Text</SelectItem>
                                            <SelectItem value="textarea">Long Text</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ))}
                        {fields.length === 0 && <p className="text-sm text-muted-foreground italic">No inputs defined. Prompt will be static.</p>}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="border-2 border-black shadow-brutal h-full">
                    <CardHeader><CardTitle>Prompt Template</CardTitle></CardHeader>
                    <CardContent className="space-y-4 h-full flex flex-col">
                        <p className="text-sm text-muted-foreground">
                            Write your prompt instructions for the AI. Use <code>{'{{variable_key}}'}</code> to insert inputs.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {fields.filter(f => f.key).map(f => (
                                <span key={f.key} className="bg-black text-white px-2 py-1 text-xs rounded cursor-pointer font-mono hover:bg-gray-800" onClick={() => setPrompt(p => p + ` {{${f.key}}} `)}>
                                    {`{{${f.key}}}`}
                                </span>
                            ))}
                        </div>
                        <Textarea 
                            className="flex-1 min-h-[300px] font-mono text-sm bg-muted/10 border-2 border-black" 
                            placeholder="Write a social media post about {{product_name}} targeted at {{audience}}..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>

        <div className="mt-8 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={loading} className="bg-green-400 hover:bg-green-500 text-black font-bold border-2 border-black shadow-brutal">
                {loading ? 'Saving...' : <><Save className="mr-2 h-4 w-4"/> Save Template</>}
            </Button>
        </div>
    </ToolLayout>
  );
}
