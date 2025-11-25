import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";
import { useBrandVoice } from "@/context/BrandVoiceContext";

interface SeoBlogOptimizerResult {
  optimized_title: string;
  optimized_meta_description: string;
  optimized_body: string;
  suggested_headings: string[];
  keyword_usage_notes: string[];
  improvements_summary: string;
}

const SeoBlogOptimizerTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    originalText: "",
    primaryKeyword: "",
    secondaryKeywords: "",
    goal: "improve organic traffic and CTR",
    tone: "neutral",
  });
  const [result, setResult] = useState<SeoBlogOptimizerResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.originalText.trim()) {
      alert("Please paste the blog article you want to optimize");
      return;
    }
    if (!formData.primaryKeyword.trim()) {
      alert("Please enter a primary keyword");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[SeoBlogOptimizerTool] Generate");
    const inputs = {
      originalText: formData.originalText,
      primaryKeyword: formData.primaryKeyword,
      secondaryKeywords: formData.secondaryKeywords,
      goal: formData.goal,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "seo_blog_optimizer",
        inputs,
        outputCount: 1,
        brandVoiceId: selectedVoiceId,
      });
      const out = data?.results as SeoBlogOptimizerResult;
      setResult(out);
      try {
        console.groupCollapsed("[SeoBlogOptimizerTool] Save results");
        await saveResults({ tool_name: "seo_blog_optimizer", input_data: inputs, results: out });
      } catch (e) {
        console.error("[SeoBlogOptimizerTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[SeoBlogOptimizerTool] Generation failed", err);
      alert(err?.message || "Failed to optimize blog article.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="SEO Blog Optimizer"
      description="Paste an existing blog post and get an SEO-optimized version with improved title, meta, and structure."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Optimization Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="original" className="font-bold uppercase text-sm">
                    Original Article *
                  </Label>
                  <Textarea
                    id="original"
                    value={formData.originalText}
                    onChange={(e) => setFormData({ ...formData, originalText: e.target.value })}
                    rows={10}
                    className="input-brutal resize-none"
                    placeholder="Paste your existing blog post here"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryKeyword" className="font-bold uppercase text-sm">
                    Primary Keyword *
                  </Label>
                  <Input
                    id="primaryKeyword"
                    value={formData.primaryKeyword}
                    onChange={(e) => setFormData({ ...formData, primaryKeyword: e.target.value })}
                    className="input-brutal"
                    placeholder="Main SEO keyword"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryKeywords" className="font-bold uppercase text-sm">
                    Secondary Keywords
                  </Label>
                  <Input
                    id="secondaryKeywords"
                    value={formData.secondaryKeywords}
                    onChange={(e) => setFormData({ ...formData, secondaryKeywords: e.target.value })}
                    className="input-brutal"
                    placeholder="Comma-separated (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal" className="font-bold uppercase text-sm">
                    Goal
                  </Label>
                  <Input
                    id="goal"
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., improve CTR, rank for specific terms, improve readability"
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
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.originalText.trim() || !formData.primaryKeyword.trim()}
                  className="w-full bg-black text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Optimize Article
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-4">
                <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
                  {result.optimized_title && (
                    <header className="space-y-2">
                      <h2 className="text-2xl font-bold">{result.optimized_title}</h2>
                      {result.optimized_meta_description && (
                        <p className="text-sm text-muted-foreground">{result.optimized_meta_description}</p>
                      )}
                    </header>
                  )}
                  {result.suggested_headings && result.suggested_headings.length > 0 && (
                    <section className="border-2 border-black bg-background p-3">
                      <div className="text-xs font-bold uppercase mb-2">Suggested Headings</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {result.suggested_headings.map((h, i) => (
                          <li key={i} className="text-sm">{h}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <section className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                    {result.optimized_body}
                  </section>
                </article>

                {(result.keyword_usage_notes?.length || result.improvements_summary) && (
                  <section className="border-4 border-black bg-background p-4 shadow-brutal">
                    <div className="text-xs font-bold uppercase mb-2">SEO Notes</div>
                    {result.improvements_summary && (
                      <p className="text-sm mb-2">{result.improvements_summary}</p>
                    )}
                    {result.keyword_usage_notes && result.keyword_usage_notes.length > 0 && (
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {result.keyword_usage_notes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Optimize Existing Blog Posts</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Paste a draft article and get an SEO-optimized version with better title, meta, and structure.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default SeoBlogOptimizerTool;
