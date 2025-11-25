import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { listTemplates, generateFromTemplate, ContentTemplate } from '@/lib/api-templates';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2, Copy, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function TemplateRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [template, setTemplate] = useState<ContentTemplate | null>(null);
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if(id) load(id);
  }, [id]);

  const load = async (templateId: string) => {
    try {
        const all = await listTemplates();
        const found = all.find(t => t.id === templateId);
        setTemplate(found || null);
    } catch(e) { console.error(e); }
  };

  const handleGenerate = async () => {
    if(!template) return;
    setLoading(true);
    setResults([]);
    try {
        const res = await generateFromTemplate(template.id, inputs);
        setResults(res);
    } catch(e) {
        toast({ title: "Generation Failed", description: "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast({ title: "Copied!" });
  };

  if (!template) return <div className="p-10 text-center">Loading template...</div>;

  return (
    <ToolLayout title={template.name} description={template.description}>
        <div className="mb-6">
            <Button variant="outline" onClick={() => navigate('/templates')} className="border-2 border-black"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Templates</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Form */}
            <Card className="border-2 border-black shadow-brutal h-fit">
                <CardHeader>
                    <CardTitle>Inputs</CardTitle>
                    <CardDescription>Provide the details below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {template.schema.map((field, idx) => (
                        <div key={idx}>
                            <label className="font-bold text-sm mb-1 block">{field.label}</label>
                            {field.type === 'textarea' ? (
                                <Textarea 
                                    placeholder={field.placeholder} 
                                    value={inputs[field.key] || ''}
                                    onChange={e => setInputs({...inputs, [field.key]: e.target.value})}
                                    className="bg-muted/10 border-2 border-black"
                                />
                            ) : (
                                <Input 
                                    type={field.type === 'number' ? 'number' : 'text'}
                                    placeholder={field.placeholder}
                                    value={inputs[field.key] || ''}
                                    onChange={e => setInputs({...inputs, [field.key]: e.target.value})}
                                    className="bg-muted/10 border-2 border-black h-10"
                                />
                            )}
                        </div>
                    ))}
                    <Button 
                        className="w-full mt-4 bg-black text-white hover:bg-gray-800 font-bold border-2 border-black" 
                        size="lg"
                        onClick={handleGenerate}
                        disabled={loading}
                    >
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</> : "Generate Content"}
                    </Button>
                </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-4">
                {results.length > 0 && <h3 className="text-xl font-black uppercase">Results</h3>}
                {results.map((res, idx) => (
                    <Card key={idx} className="border-2 border-black shadow-brutal bg-white">
                        <CardContent className="p-4 pt-6 relative">
                            <div className="whitespace-pre-wrap font-mono text-sm">{res.text}</div>
                            <div className="absolute top-2 right-2">
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(res.text, idx)}>
                                    {copiedIdx === idx ? <Check className="h-4 w-4 text-green-600"/> : <Copy className="h-4 w-4"/>}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {results.length === 0 && !loading && (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded p-10 text-muted-foreground">
                        <p>Results will appear here.</p>
                    </div>
                )}
                {loading && (
                    <div className="h-64 flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/>
                            <p>AI is writing...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </ToolLayout>
  );
}
