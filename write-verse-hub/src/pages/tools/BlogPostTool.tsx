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

interface BlogPostResult {
  title: string;
  slug_suggestion: string;
  outline: string[];
  body: string;
  meta_description: string;
}

const BlogPostTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    topic: "",
    audience: "general readers",
    goal: "educate and engage",
    primaryKeyword: "",
    secondaryKeywords: "",
    outlineMode: "auto" as "auto" | "custom",
    customOutline: "",
    length: "medium" as "short" | "medium" | "long",
    tone: "neutral",
  });
  const [result, setResult] = useState<BlogPostResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const cleanText = (value: any): string => {
    if (!value) return "";
    return String(value)
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/`{1,3}([^`]+)`{1,3}/g, "$1");
  };

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      alert("Please enter a topic");
      return;
    }
    if (formData.outlineMode === "custom" && !formData.customOutline.trim()) {
      alert("Please provide a custom outline or switch outline mode to Auto");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[BlogPostTool] Generate");
    const inputs = {
      topic: formData.topic,
      audience: formData.audience,
      goal: formData.goal,
      primaryKeyword: formData.primaryKeyword,
      secondaryKeywords: formData.secondaryKeywords,
      outlineMode: formData.outlineMode,
      customOutline: formData.outlineMode === "custom" ? formData.customOutline : "",
      length: formData.length,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "blog_post",
        inputs,
        outputCount: 1,
        brandVoiceId: selectedVoiceId,
      });
      const raw = (data as any)?.results;
      const item: any = Array.isArray(raw) ? raw[0] : raw || {};

      // Robustly clean all fields to ensure no raw JSON leaks into the UI
      const out: BlogPostResult = {
        title: cleanText(item.title || inputs.topic),
        slug_suggestion: cleanText(item.slug_suggestion),
        outline: Array.isArray(item.outline)
          ? item.outline.map((h: any) => cleanText(h))
          : [],
        body: cleanText(item.body || item.content || ""),
        meta_description: cleanText(item.meta_description),
      };

      // If body is still empty but we have raw text, use that as fallback body
      if (!out.body && typeof item === 'string') {
        out.body = cleanText(item);
      }

      setResult(out);
      try {
        console.groupCollapsed("[BlogPostTool] Save results");
        await saveResults({ tool_name: "blog_post", input_data: inputs, results: out });
      } catch (e) {
        console.error("[BlogPostTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[BlogPostTool] Generation failed", err);
      alert(err?.message || "Failed to generate blog post.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Full Blog Post Writer"
      description="Generate a complete long-form blog article from a topic, audience, and goals."
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
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Topic / Working Title *
                  </Label>
                  <Textarea
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    rows={3}
                    className="input-brutal resize-none"
                    placeholder="E.g., How AI is changing content marketing"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Audience</Label>
                  <Input
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., SaaS founders, content marketers, developers"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Goal</Label>
                  <Input
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., educate, generate leads, build authority"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Primary Keyword</Label>
                  <Input
                    value={formData.primaryKeyword}
                    onChange={(e) => setFormData({ ...formData, primaryKeyword: e.target.value })}
                    className="input-brutal"
                    placeholder="Main SEO keyword (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Secondary Keywords</Label>
                  <Input
                    value={formData.secondaryKeywords}
                    onChange={(e) => setFormData({ ...formData, secondaryKeywords: e.target.value })}
                    className="input-brutal"
                    placeholder="Comma-separated, optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Outline Mode</Label>
                  <Select
                    value={formData.outlineMode}
                    onValueChange={(v) => setFormData({ ...formData, outlineMode: v as any })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-generate outline</SelectItem>
                      <SelectItem value="custom">Use my outline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.outlineMode === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="outline" className="font-bold uppercase text-sm">
                      Custom Outline
                    </Label>
                    <Textarea
                      id="outline"
                      value={formData.customOutline}
                      onChange={(e) => setFormData({ ...formData, customOutline: e.target.value })}
                      rows={6}
                      className="input-brutal resize-none"
                      placeholder="One heading per line, optionally with subpoints"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Length</Label>
                  <Select
                    value={formData.length}
                    onValueChange={(v) => setFormData({ ...formData, length: v as any })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medium">Medium (~1500 words)</SelectItem>
                      <SelectItem value="long">Long (3000+ words)</SelectItem>
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
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.topic.trim()}
                  className="w-full bg-black text-white"
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
                      Generate Blog Post
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {result ? (
              <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
                {result.title && (
                  <header className="space-y-2">
                    <h2 className="text-2xl font-bold">{result.title}</h2>
                    {result.meta_description && (
                      <p className="text-sm text-muted-foreground">{result.meta_description}</p>
                    )}
                  </header>
                )}
                {result.outline && result.outline.length > 0 && (
                  <section className="border-2 border-black bg-background p-3">
                    <div className="text-xs font-bold uppercase mb-2">Outline</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.outline.map((h, i) => (
                        <li key={i} className="text-sm">{h}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <section className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {result.body}
                </section>
              </article>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Ready to Draft a Full Blog Post</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Describe your topic, audience, and goals, then generate a complete long-form article.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default BlogPostTool;
