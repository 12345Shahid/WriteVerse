import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useModel } from "@/context/ModelContext";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";

interface SummaryOut { summary: string; readability: string; keyPoints: string[]; keywords: string[]; readingTime: string; timeSaved: string; }

const SummarizerTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({ text: "", length: "short", tone: "professional" });
  const [result, setResult] = useState<SummaryOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.text.trim()) { alert("Please paste text to summarize"); return; }
    setIsLoading(true);
    console.groupCollapsed("[SummarizerTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({ tool: "summarizer", inputs: formData, outputCount: 1, modelId: selectedModelId, brandVoiceId: selectedVoiceId });
      const out = (data?.results ?? null) as any;
      setResult(out as SummaryOut);
      try {
        console.groupCollapsed("[SummarizerTool] Save results");
        await saveResults({ tool_name: "summarizer", input_data: formData, results: out });
      } catch (e) { console.error("[SummarizerTool] Save failed", e); } finally { console.groupEnd(); }
    } catch (err: any) {
      console.error("[SummarizerTool] Generation failed", err);
      alert(err?.message || "Failed to generate summary.");
    } finally { console.groupEnd(); setIsLoading(false); }
  };

  return (
    <ToolLayout title="Paragraph Summarizer" description="Condense long text into clear, skimmable summaries with key points">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-purple p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="h-6 w-6"/>Text</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="text" className="font-bold uppercase text-sm">Paste Text *</Label>
                  <Textarea id="text" value={formData.text} onChange={(e)=>setFormData({...formData, text:e.target.value})} rows={10} className="input-brutal resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Summary Length</Label>
                  <Select value={formData.length} onValueChange={(v)=>setFormData({...formData, length:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (≈50 words)</SelectItem>
                      <SelectItem value="medium">Medium (≈100 words)</SelectItem>
                      <SelectItem value="long">Long (≈200 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Tone</Label>
                  <Select value={formData.tone} onValueChange={(v)=>setFormData({...formData, tone:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={isLoading || !formData.text.trim() || isViewer}
                  className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                  title={isViewer ? 'Viewers cannot generate content' : ''} className="w-full bg-black text-white" size="lg">
                  {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Summarizing...</>) : (<><Sparkles className="mr-2 h-5 w-5"/>Summarize</>)}
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-4">
                <div className="border-4 border-black bg-card p-6 shadow-brutal">
                  <div className="text-sm font-bold uppercase mb-2">Summary</div>
                  <p className="font-medium whitespace-pre-wrap">{result.summary}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border-4 border-black bg-card p-4">
                    <div className="text-xs font-bold uppercase">Readability</div>
                    <div className="text-lg font-bold">{result.readability}</div>
                  </div>
                  <div className="border-4 border-black bg-card p-4">
                    <div className="text-xs font-bold uppercase">Reading Time</div>
                    <div className="text-lg font-bold">{result.readingTime} • {result.timeSaved} saved</div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border-4 border-black bg-card p-4">
                    <div className="text-xs font-bold uppercase mb-2">Key Points</div>
                    <ul className="list-disc pl-6 text-sm font-medium space-y-1">{result.keyPoints?.map((x,i)=>(<li key={i}>{x}</li>))}</ul>
                  </div>
                  <div className="border-4 border-black bg-card p-4">
                    <div className="text-xs font-bold uppercase mb-2">Keywords</div>
                    <div className="text-sm font-medium">{result.keywords?.join(', ')}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground"/>
                <h3 className="text-2xl font-bold mb-2">Ready to Summarize</h3>
                <p className="text-lg font-medium text-muted-foreground">Paste text and choose length/tone</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default SummarizerTool;
