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

interface Segment { time: string; line: string }
interface ScriptOut { segments: Segment[]; pacingWpm: number; wordCount: number; readTime: string }

const ScriptTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({ topic: "", duration: "60 sec", tone: "upbeat", viewer: "general" });
  const [result, setResult] = useState<ScriptOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.topic.trim()) { alert("Please enter a video topic"); return; }
    setIsLoading(true);
    console.groupCollapsed("[ScriptTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({ tool: "script", inputs: formData, outputCount: 1, modelId: selectedModelId, brandVoiceId: selectedVoiceId });
      const out = (data?.results ?? null) as any;
      setResult(out as ScriptOut);
      try {
        console.groupCollapsed("[ScriptTool] Save results");
        await saveResults({ tool_name: "script", input_data: formData, results: out });
      } catch (e) { console.error("[ScriptTool] Save failed", e); } finally { console.groupEnd(); }
    } catch (err: any) {
      console.error("[ScriptTool] Generation failed", err);
      alert(err?.message || "Failed to generate script.");
    } finally { console.groupEnd(); setIsLoading(false); }
  };

  return (
    <ToolLayout title="Script / Voiceover Writer" description="Generate a timed script with pacing and action markers">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-blue p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="h-6 w-6"/>Inputs</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Topic *</Label>
                  <Textarea value={formData.topic} onChange={(e)=>setFormData({...formData, topic:e.target.value})} rows={4} className="input-brutal resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Duration</Label>
                  <Select value={formData.duration} onValueChange={(v)=>setFormData({...formData, duration:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30 sec">30 sec</SelectItem>
                      <SelectItem value="60 sec">60 sec</SelectItem>
                      <SelectItem value="90 sec">90 sec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Tone</Label>
                  <Select value={formData.tone} onValueChange={(v)=>setFormData({...formData, tone:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upbeat">Upbeat</SelectItem>
                      <SelectItem value="serious">Serious</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Target Viewer</Label>
                  <Select value={formData.viewer} onValueChange={(v)=>setFormData({...formData, viewer:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="creators">Creators</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={isLoading || !formData.topic.trim() || isViewer}
                  className={`w-full bg-black text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`} title={isViewer ? 'Viewers cannot generate content' : ''} size="lg">
                  {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Generating...</>) : (<><Sparkles className="mr-2 h-5 w-5"/>Generate Script</>)}
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Pacing</div><div className="text-lg font-bold">{result.pacingWpm} wpm</div></div>
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Word Count</div><div className="text-lg font-bold">{result.wordCount}</div></div>
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Read Time</div><div className="text-lg font-bold">{result.readTime}</div></div>
                </div>
                <div className="space-y-3">
                  {result.segments?.map((s, i)=> (
                    <div key={i} className="border-2 border-black bg-background p-3 font-medium whitespace-pre-wrap">
                      <span className="uppercase text-xs font-bold mr-2">{s.time}</span>
                      {s.line}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground"/>
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">Enter topic, duration, tone and viewer</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ScriptTool;
