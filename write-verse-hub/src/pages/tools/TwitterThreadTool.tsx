import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useModel } from "@/context/ModelContext";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";

interface ThreadOut { tweets: string[]; engagementPrediction: string; hashtags: string; }

const TwitterThreadTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({ topic: "", audience: "general", tone: "educational", length: 5 });
  const [result, setResult] = useState<ThreadOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.topic.trim()) { alert("Please enter a topic"); return; }
    setIsLoading(true);
    console.groupCollapsed("[TwitterThreadTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({ tool: "twitter_thread", inputs: formData, outputCount: 1, modelId: selectedModelId, brandVoiceId: selectedVoiceId });
      const out = (data?.results ?? null) as any;
      setResult(out as ThreadOut);
      try {
        console.groupCollapsed("[TwitterThreadTool] Save results");
        await saveResults({ tool_name: "twitter_thread", input_data: formData, results: out });
      } catch (e) { console.error("[TwitterThreadTool] Save failed", e); } finally { console.groupEnd(); }
    } catch (err: any) {
      console.error("[TwitterThreadTool] Generation failed", err);
      alert(err?.message || "Failed to generate thread.");
    } finally { console.groupEnd(); setIsLoading(false); }
  };

  return (
    <ToolLayout title="Twitter/X Thread Composer" description="Compose numbered threads with hooks, hashtags and engagement cues">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-orange p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="h-6 w-6"/>Thread Inputs</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Topic *</Label>
                  <Textarea value={formData.topic} onChange={(e)=>setFormData({...formData, topic:e.target.value})} rows={4} className="input-brutal resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Audience</Label>
                  <Select value={formData.audience} onValueChange={(v)=>setFormData({...formData, audience:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="founders">Founders</SelectItem>
                      <SelectItem value="developers">Developers</SelectItem>
                      <SelectItem value="marketers">Marketers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Tone</Label>
                  <Select value={formData.tone} onValueChange={(v)=>setFormData({...formData, tone:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="entertaining">Entertaining</SelectItem>
                      <SelectItem value="promotional">Promotional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Length</Label>
                  <Input type="number" min={3} max={20} value={formData.length} onChange={(e)=>setFormData({...formData, length: Number(e.target.value)})} className="input-brutal"/>
                </div>
                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={isLoading || !formData.topic.trim() || isViewer}
                  className={`w-full bg-black text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`} title={isViewer ? 'Viewers cannot generate content' : ''} size="lg">
                  {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Composing...</>) : (<><Sparkles className="mr-2 h-5 w-5"/>Compose Thread</>)}
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-4">
                <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Prediction</div><div className="text-sm font-medium">{result.engagementPrediction}</div></div>
                <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Hashtags</div><div className="text-sm font-medium">{result.hashtags}</div></div>
                <ol className="list-decimal pl-6 space-y-2">
                  {result.tweets?.map((t, i)=> (
                    <li key={i} className="border-2 border-black bg-background p-3 font-medium whitespace-pre-wrap">{t}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground"/>
                <h3 className="text-2xl font-bold mb-2">Ready to Compose</h3>
                <p className="text-lg font-medium text-muted-foreground">Enter topic, audience, tone and length</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default TwitterThreadTool;
