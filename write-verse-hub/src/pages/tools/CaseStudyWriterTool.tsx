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

interface CaseStudyResult {
  headline: string;
  summary: string;
  background: string;
  challenge: string;
  solution: string;
  results: string;
  quote: string;
}

const CaseStudyWriterTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    clientName: "",
    industry: "",
    problem: "",
    solution: "",
    results: "",
    tone: "professional",
  });
  const [result, setResult] = useState<CaseStudyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.problem.trim() || !formData.solution.trim() || !formData.results.trim()) {
      alert("Please fill in problem, solution, and results");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[CaseStudyWriterTool] Generate");
    const inputs = {
      clientName: formData.clientName,
      industry: formData.industry,
      problem: formData.problem,
      solution: formData.solution,
      results: formData.results,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "case_study_writer",
        inputs,
        outputCount: 1,
        brandVoiceId: selectedVoiceId,
      });
      const out = data?.results as CaseStudyResult;
      setResult(out);
      try {
        console.groupCollapsed("[CaseStudyWriterTool] Save results");
        await saveResults({ tool_name: "case_study_writer", input_data: inputs, results: out });
      } catch (e) {
        console.error("[CaseStudyWriterTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[CaseStudyWriterTool] Generation failed", err);
      alert(err?.message || "Failed to generate case study.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Case Study Writer"
      description="Turn client results into a structured B2B case study or success story."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Case Study Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="client" className="font-bold uppercase text-sm">
                    Client Name (optional)
                  </Label>
                  <Input
                    id="client"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., Acme Corp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry" className="font-bold uppercase text-sm">
                    Industry (optional)
                  </Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., SaaS, eCommerce, Fintech"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="problem" className="font-bold uppercase text-sm">
                    Problem / Challenge *
                  </Label>
                  <Textarea
                    id="problem"
                    value={formData.problem}
                    onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="Describe the main pain points and challenges"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solution" className="font-bold uppercase text-sm">
                    Solution *
                  </Label>
                  <Textarea
                    id="solution"
                    value={formData.solution}
                    onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="What did you or your product do to solve the problem?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="results" className="font-bold uppercase text-sm">
                    Results & Metrics *
                  </Label>
                  <Textarea
                    id="results"
                    value={formData.results}
                    onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="Quantify outcomes: % lifts, revenue, time saved, etc."
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
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={
                    isLoading ||
                    !formData.problem.trim() ||
                    !formData.solution.trim() ||
                    !formData.results.trim()
                  }
                  className="w-full bg-black text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Writing Case Study...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Case Study
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {result ? (
              <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
                {result.headline && (
                  <header className="space-y-2">
                    <h2 className="text-2xl font-bold">{result.headline}</h2>
                    {result.summary && (
                      <p className="text-sm text-muted-foreground">{result.summary}</p>
                    )}
                  </header>
                )}
                {result.background && (
                  <section className="space-y-1">
                    <h3 className="text-lg font-bold">Background</h3>
                    <p className="whitespace-pre-wrap text-sm">{result.background}</p>
                  </section>
                )}
                {result.challenge && (
                  <section className="space-y-1">
                    <h3 className="text-lg font-bold">Challenge</h3>
                    <p className="whitespace-pre-wrap text-sm">{result.challenge}</p>
                  </section>
                )}
                {result.solution && (
                  <section className="space-y-1">
                    <h3 className="text-lg font-bold">Solution</h3>
                    <p className="whitespace-pre-wrap text-sm">{result.solution}</p>
                  </section>
                )}
                {result.results && (
                  <section className="space-y-1">
                    <h3 className="text-lg font-bold">Results</h3>
                    <p className="whitespace-pre-wrap text-sm">{result.results}</p>
                  </section>
                )}
                {result.quote && (
                  <section className="space-y-1 border-l-4 border-black pl-4">
                    <h3 className="text-xs font-bold uppercase">Client Quote</h3>
                    <p className="italic text-sm">“{result.quote}”</p>
                  </section>
                )}
              </article>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Turn Wins into Case Studies</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Describe the problem, solution, and results, then generate a polished case study.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default CaseStudyWriterTool;
