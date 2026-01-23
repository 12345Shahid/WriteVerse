import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useModel } from "@/context/ModelContext";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";

interface FaqItem { question: string; answer: string }
interface FaqOut { items: FaqItem[]; seoScore: string; schemaMarkup: string }

const FAQTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({ productName: "", painPoints: "", features: "", count: "10" });
  const [result, setResult] = useState<FaqOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.productName.trim()) { alert("Please enter product/service name"); return; }
    setIsLoading(true);
    console.groupCollapsed("[FAQTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "faq",
        inputs: { ...formData, count: Number(formData.count) },
        outputCount: 1,
        modelId: selectedModelId,
        brandVoiceId: selectedVoiceId,
      });
      const out = (data?.results ?? null) as any;
      setResult(out as FaqOut);
      try {
        console.groupCollapsed("[FAQTool] Save results");
        await saveResults({ tool_name: "faq", input_data: formData, results: out });
      } catch (e) { console.error("[FAQTool] Save failed", e); } finally { console.groupEnd(); }
    } catch (err: any) {
      console.error("[FAQTool] Generation failed", err);
      alert(err?.message || "Failed to generate FAQ.");
    } finally { console.groupEnd(); setIsLoading(false); }
  };

  return (
    <ToolLayout title="FAQ Generator" description="Create a structured FAQ section with SEO considerations">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-green p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="h-6 w-6"/>Inputs</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Product/Service *</Label>
                  <Input value={formData.productName} onChange={(e)=>setFormData({...formData, productName:e.target.value})} className="input-brutal"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Customer Pain Points</Label>
                  <Textarea value={formData.painPoints} onChange={(e)=>setFormData({...formData, painPoints:e.target.value})} rows={3} className="input-brutal resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Features</Label>
                  <Textarea value={formData.features} onChange={(e)=>setFormData({...formData, features:e.target.value})} rows={3} className="input-brutal resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">FAQ Count</Label>
                  <Select value={formData.count} onValueChange={(v)=>setFormData({...formData, count:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={isLoading || !formData.productName.trim() || isViewer}
                  className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                  title={isViewer ? 'Viewers cannot generate content' : ''} className="w-full bg-black text-white" size="lg">
                  {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Generating...</>) : (<><Sparkles className="mr-2 h-5 w-5"/>Generate FAQ</>)}
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">SEO Score</div><div className="text-lg font-bold">{result.seoScore}</div></div>
                  <div className="border-4 border-black bg-card p-4">
                    <div className="text-xs font-bold uppercase mb-2">Schema Markup (JSON-LD)</div>
                    <Textarea value={result.schemaMarkup} readOnly rows={6} className="input-brutal resize-none"/>
                  </div>
                </div>
                <div className="space-y-3">
                  {result.items?.map((it, i)=> (
                    <div key={i} className="border-4 border-black bg-card p-4">
                      <div className="text-sm font-bold">Q: {it.question}</div>
                      <div className="text-sm font-medium mt-1">A: {it.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground"/>
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">Enter product, pain points and features</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default FAQTool;
