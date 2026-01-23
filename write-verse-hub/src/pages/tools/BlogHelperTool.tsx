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

interface BlogResult { text: string; }

const modes = [
  { value: "intro", label: "Blog Intro" },
  { value: "outline", label: "Blog Outline" },
  { value: "conclusion", label: "Conclusion" },
  { value: "section", label: "Section" },
  { value: "paragraph", label: "Paragraph" },
  { value: "paragraph_expand", label: "Expand Paragraph" },
  { value: "sentence_expand", label: "Expand Sentence" },
  { value: "article_expand", label: "Expand Article" },
  { value: "article_rewrite", label: "Rewrite Article" },
];

const modesNeedingSource = new Set([
  "paragraph_expand",
  "sentence_expand",
  "article_expand",
  "article_rewrite",
]);

const BlogHelperTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    mode: "intro",
    topic: "",
    audience: "general",
    keywords: "",
    tone: "neutral",
    sourceText: "",
    outputCount: 3,
  });
  const [results, setResults] = useState<BlogResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.topic.trim()) {
      alert("Please enter a topic");
      return;
    }
    const needsSource = modesNeedingSource.has(formData.mode as any);
    if (needsSource && !formData.sourceText.trim()) {
      alert("Please provide source text for this mode");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[BlogHelperTool] Generate");
    const inputs = {
      mode: formData.mode,
      topic: formData.topic,
      audience: formData.audience,
      keywords: formData.keywords,
      tone: formData.tone,
      sourceText: needsSource ? formData.sourceText : "",
    };
    console.debug("inputs", inputs);
    try {
      const data = await generate({
        tool: "blog_helper",
        inputs,
        outputCount: formData.outputCount,
        modelId: selectedModelId,
        brandVoiceId: selectedVoiceId,
      });
      const out = (data?.results ?? []) as BlogResult[];
      setResults(out);
      try {
        console.groupCollapsed("[BlogHelperTool] Save results");
        await saveResults({ tool_name: "blog_helper", input_data: inputs, results: out });
      } catch (e) {
        console.error("[BlogHelperTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[BlogHelperTool] Generation failed", err);
      alert(err?.message || "Failed to generate blog content.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  const needsSourceText = modesNeedingSource.has(formData.mode as any);

  return (
    <ToolLayout
      title="Blog & Article Helper"
      description="Generate intros, outlines, sections, and short expansions for your blog posts."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Blog Inputs
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
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Topic *
                  </Label>
                  <Textarea
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="E.g., How to start a newsletter, Benefits of remote work..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Audience</Label>
                  <Select
                    value={formData.audience}
                    onValueChange={(v) => setFormData({ ...formData, audience: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="marketers">Marketers</SelectItem>
                      <SelectItem value="founders">Founders</SelectItem>
                      <SelectItem value="developers">Developers</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords" className="font-bold uppercase text-sm">
                    Keywords (optional)
                  </Label>
                  <Input
                    id="keywords"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    className="input-brutal"
                    placeholder="SEO keywords separated by commas"
                  />
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
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {needsSourceText && (
                  <div className="space-y-2">
                    <Label htmlFor="source" className="font-bold uppercase text-sm">
                      Source Text *
                    </Label>
                    <Textarea
                      id="source"
                      value={formData.sourceText}
                      onChange={(e) => setFormData({ ...formData, sourceText: e.target.value })}
                      rows={6}
                      className="input-brutal resize-none"
                      placeholder="Paste the paragraph or article to expand or rewrite"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="count" className="font-bold uppercase text-sm">
                    Variations
                  </Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.outputCount}
                    onChange={(e) =>
                      setFormData({ ...formData, outputCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
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
                  disabled={isLoading || !formData.topic.trim() || isViewer}
                  className={`w-full bg-black text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isViewer ? 'Viewers cannot generate content' : ''}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Variations
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
                <h3 className="text-2xl font-bold mb-2">Ready to Generate Blog Content</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Choose a mode, enter your topic, and click generate.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default BlogHelperTool;
