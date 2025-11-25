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

interface ArticleFromOutlineResult {
  title: string;
  outline: string[];
  body: string;
}

const ArticleFromOutlineTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    topic: "",
    outline: "",
    audience: "general readers",
    length: "medium" as "short" | "medium" | "long",
    tone: "neutral",
  });
  const [result, setResult] = useState<ArticleFromOutlineResult | null>(null);
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
      alert("Please enter a title or topic");
      return;
    }
    if (!formData.outline.trim()) {
      alert("Please provide an outline (one heading per line)");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[ArticleFromOutlineTool] Generate");
    const inputs = {
      topic: formData.topic,
      outline: formData.outline,
      audience: formData.audience,
      length: formData.length,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "article_from_outline",
        inputs,
        outputCount: 1,
        brandVoiceId: selectedVoiceId,
      });
      const raw = (data as any)?.results;
      const item: any = Array.isArray(raw) ? raw[0] : raw || {};
      
      // Robustly clean fields
      const out: ArticleFromOutlineResult = {
        title: cleanText(item.title || inputs.topic),
        outline: Array.isArray(item.outline)
          ? item.outline.map((h: any) => cleanText(h))
          : [],
        body: cleanText(item.body || item.content || ""),
      };

      // Fallback for body
      if (!out.body && typeof item === 'string') {
        out.body = cleanText(item);
      }

      setResult(out);
      try {
        console.groupCollapsed("[ArticleFromOutlineTool] Save results");
        await saveResults({ tool_name: "article_from_outline", input_data: inputs, results: out });
      } catch (e) {
        console.error("[ArticleFromOutlineTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[ArticleFromOutlineTool] Generation failed", err);
      alert(err?.message || "Failed to generate article.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Article From Outline"
      description="Turn your outline into a complete long-form article with sections and smooth flow."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Article Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Title / Topic *
                  </Label>
                  <Input
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., 7 Principles of Effective Remote Teams"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outline" className="font-bold uppercase text-sm">
                    Outline *
                  </Label>
                  <Textarea
                    id="outline"
                    value={formData.outline}
                    onChange={(e) => setFormData({ ...formData, outline: e.target.value })}
                    rows={8}
                    className="input-brutal resize-none"
                    placeholder="One heading per line. You can include subpoints beneath headings."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Audience</Label>
                  <Input
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., engineering managers, solo founders, marketers"
                  />
                </div>

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
                      <SelectItem value="educational">Educational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.topic.trim() || !formData.outline.trim()}
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
                      Expand Outline
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
                <h3 className="text-2xl font-bold mb-2">Turn Outlines into Articles</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Paste your outline and generate a complete long-form article with one click.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ArticleFromOutlineTool;
