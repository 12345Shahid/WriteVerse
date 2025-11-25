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

interface ReportWriterResult {
  title: string;
  abstract: string;
  sections: { heading: string; body: string }[];
}

const ReportWriterTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    topic: "",
    audience: "executives",
    keyPoints: "",
    sections: "",
    length: "long" as "short" | "medium" | "long",
    tone: "formal",
  });
  const [result, setResult] = useState<ReportWriterResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.topic.trim() || !formData.keyPoints.trim()) {
      alert("Please provide a topic and key points/thesis");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[ReportWriterTool] Generate");
    const inputs = {
      topic: formData.topic,
      audience: formData.audience,
      keyPoints: formData.keyPoints,
      sections: formData.sections,
      length: formData.length,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "report_writer",
        inputs,
        outputCount: 1,
        brandVoiceId: selectedVoiceId,
      });
      const out = data?.results as ReportWriterResult;
      setResult(out);
      try {
        console.groupCollapsed("[ReportWriterTool] Save results");
        await saveResults({ tool_name: "report_writer", input_data: inputs, results: out });
      } catch (e) {
        console.error("[ReportWriterTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[ReportWriterTool] Generation failed", err);
      alert(err?.message || "Failed to generate report.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Report / Whitepaper Writer"
      description="Draft structured reports and whitepapers from a topic, key points, and target audience."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Report Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Topic *
                  </Label>
                  <Input
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., State of AI in B2B Marketing 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience" className="font-bold uppercase text-sm">
                    Audience
                  </Label>
                  <Input
                    id="audience"
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., CMOs, CTOs, product leaders"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyPoints" className="font-bold uppercase text-sm">
                    Key Points / Thesis *
                  </Label>
                  <Textarea
                    id="keyPoints"
                    value={formData.keyPoints}
                    onChange={(e) => setFormData({ ...formData, keyPoints: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="Summarize the main arguments or findings you want in the report"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sections" className="font-bold uppercase text-sm">
                    Desired Sections (optional)
                  </Label>
                  <Textarea
                    id="sections"
                    value={formData.sections}
                    onChange={(e) => setFormData({ ...formData, sections: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="If you have an outline, list section headings here"
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
                      <SelectItem value="short">Short (~1500 words)</SelectItem>
                      <SelectItem value="medium">Medium (~2500 words)</SelectItem>
                      <SelectItem value="long">Long (~3000+ words)</SelectItem>
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
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="analytical">Analytical</SelectItem>
                      <SelectItem value="executive">Executive Summary Style</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.topic.trim() || !formData.keyPoints.trim()}
                  className="w-full bg-black text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Drafting Report...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Report
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
                    {result.abstract && (
                      <p className="text-sm text-muted-foreground">{result.abstract}</p>
                    )}
                  </header>
                )}
                {result.sections && result.sections.length > 0 && (
                  <div className="space-y-4">
                    {result.sections.map((s, i) => (
                      <section key={i} className="space-y-1">
                        {s.heading && <h3 className="text-lg font-bold">{s.heading}</h3>}
                        <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                      </section>
                    ))}
                  </div>
                )}
              </article>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Draft In-Depth Reports</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Provide a topic and key points to generate a structured report or whitepaper.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ReportWriterTool;
