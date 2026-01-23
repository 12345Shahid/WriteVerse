import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useModel } from "@/context/ModelContext";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";

interface RewriteResult { text: string }

const modes = [
  { value: "rewrite", label: "Rewrite" },
  { value: "improve", label: "Improve Clarity" },
  { value: "simplify", label: "Simplify" },
  { value: "formal", label: "More Formal" },
  { value: "casual", label: "More Casual" },
  { value: "shorten", label: "Shorten" },
  { value: "expand", label: "Expand" },
  { value: "tone_change", label: "Change Tone" },
];

const RewriteHelperTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    mode: "rewrite",
    tone: "neutral",
    length: "same",
    instructions: "",
    sourceText: "",
    outputCount: 2,
  });
  const [results, setResults] = useState<RewriteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.sourceText.trim()) {
      alert("Please paste the text you want to rewrite");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[RewriteHelperTool] Generate");
    const inputs = {
      mode: formData.mode,
      tone: formData.tone,
      length: formData.length,
      instructions: formData.instructions,
      sourceText: formData.sourceText,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "rewrite_helper",
        inputs,
        outputCount: formData.outputCount,
        modelId: selectedModelId,
        brandVoiceId: selectedVoiceId,
      });
      const out = (data?.results ?? []) as RewriteResult[];
      setResults(out);
      try {
        console.groupCollapsed("[RewriteHelperTool] Save results");
        await saveResults({ tool_name: "rewrite_helper", input_data: inputs, results: out });
      } catch (e) {
        console.error("[RewriteHelperTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[RewriteHelperTool] Generation failed", err);
      alert(err?.message || "Failed to rewrite text.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Rewrite & Editing Helper"
      description="Rewrite, simplify, or re-tone your text while keeping the original meaning."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Rewrite Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Mode</Label>
                  <Select
                    value={formData.mode}
                    onValueChange={(v) => setFormData({ ...formData, mode: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modes.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Tone</Label>
                  <Select
                    value={formData.tone}
                    onValueChange={(v) => setFormData({ ...formData, tone: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Target Length</Label>
                  <Select
                    value={formData.length}
                    onValueChange={(v) => setFormData({ ...formData, length: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same">Similar Length</SelectItem>
                      <SelectItem value="shorter">Shorter</SelectItem>
                      <SelectItem value="longer">Longer / Expanded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions" className="font-bold uppercase text-sm">
                    Extra Instructions (optional)
                  </Label>
                  <Input
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    className="input-brutal"
                    placeholder="e.g. keep technical terms, make it more persuasive, keep under 150 words"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source" className="font-bold uppercase text-sm">
                    Source Text *
                  </Label>
                  <Textarea
                    id="source"
                    value={formData.sourceText}
                    onChange={(e) => setFormData({ ...formData, sourceText: e.target.value })}
                    rows={8}
                    className="input-brutal resize-none"
                    placeholder="Paste the paragraph or section you want rewritten"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="count" className="font-bold uppercase text-sm">
                    Variations
                  </Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={5}
                    value={formData.outputCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        outputCount: Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                      })
                    }
                    className="input-brutal w-24"
                  />
                </div>

                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.sourceText.trim() || isViewer}
                  className={`w-full bg-black text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isViewer ? 'Viewers cannot generate content' : ''}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Rewriting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Rewrite Text
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((r, idx) => (
                  <div key={idx} className="border-4 border-black bg-card p-4 shadow-brutal">
                    <div className="text-xs font-bold uppercase mb-2">Variation #{idx + 1}</div>
                    <p className="whitespace-pre-wrap font-medium">{r.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Make Any Paragraph Clear and Polished</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Paste your text, choose how you want it rewritten, and get cleaner, sharper versions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default RewriteHelperTool;
