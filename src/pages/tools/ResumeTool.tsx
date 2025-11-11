import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { ResultCard } from "@/components/tool/ResultCard";
import { generate, saveResults } from "@/lib/api";
import { exportCsv, exportPdf } from "@/lib/export";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

/**
 * Resume Bullet Point Generator Tool
 * 
 * Creates ATS-optimized resume bullets highlighting achievements.
 * 
 * Inputs:
 * - Job title
 * - Achievements/responsibilities
 * - Quantifiable metrics
 * 
 * Output: 5 powerful resume bullets with:
 * - Action verb suggestions
 * - Metrics highlighting
 * - Industry keywords
 * 
 * TODO for backend developer:
 * - Same API structure as EmailSubjectTool
 * - tool: "resume"
 * - Use Gemini for generation
 * - Parse and return structured results
 */

interface Result {
  text: string;
  actionVerb: string;
  score: string;
}

const ResumeTool = () => {
  const [formData, setFormData] = useState({
    jobTitle: "",
    achievements: "",
    metrics: ""
  });
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.jobTitle.trim() || !formData.achievements.trim()) {
      alert("Please fill in job title and achievements");
      return;
    }

    setIsLoading(true);

    console.groupCollapsed("[ResumeTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "resume",
        inputs: formData,
        outputCount: 5,
      });
      const arr = (data?.results ?? []) as Result[];
      console.debug("results.count", Array.isArray(arr) ? arr.length : 0);
      setResults(arr);
      try {
        console.groupCollapsed("[ResumeTool] Save results");
        await saveResults({ tool_name: "resume", input_data: formData, results: arr });
      } catch (e) {
        console.error("[ResumeTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[ResumeTool] Generation failed", err);
      alert(err?.message || "Failed to generate results. Check console for details.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Resume Bullet Point Generator"
      description="Create ATS-optimized resume bullets that highlight your achievements"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-pink p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Your Experience
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="font-bold uppercase text-sm">
                    Job Title *
                  </Label>
                  <Input
                    id="jobTitle"
                    placeholder="E.g., Software Engineer, Product Manager..."
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="input-brutal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="achievements" className="font-bold uppercase text-sm">
                    Key Achievements *
                  </Label>
                  <Textarea
                    id="achievements"
                    placeholder="Describe your main accomplishments, projects, and responsibilities..."
                    value={formData.achievements}
                    onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                    className="input-brutal resize-none"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metrics" className="font-bold uppercase text-sm">
                    Quantifiable Metrics (Optional)
                  </Label>
                  <Textarea
                    id="metrics"
                    placeholder="E.g., Increased sales by 30%, Managed budget of $500K, Team of 10..."
                    value={formData.metrics}
                    onChange={(e) => setFormData({ ...formData, metrics: e.target.value })}
                    className="input-brutal resize-none"
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.jobTitle.trim() || !formData.achievements.trim()}
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
                      Generate Resume Bullets
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Your Resume Bullets</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      try {
                        console.groupCollapsed("[ResumeTool] Export all CSV");
                        exportCsv(
                          "writerai-resume-bullets.csv",
                          results.map((r) => ({ text: r.text, actionVerb: r.actionVerb, score: r.score }))
                        );
                      } catch (e) {
                        console.error("[ResumeTool] Export failed", e);
                        alert("Export failed. See console for details.");
                      } finally {
                        console.groupEnd();
                      }
                    }}>
                      Export CSV
                    </Button>
                    <Button variant="outline" onClick={() => {
                      try {
                        const blocks = [
                          { heading: 'Resume Bullets', lines: results.map((r) => `• ${r.text}`) },
                          { heading: 'Action Verbs', lines: results.map((r, i) => `#${i+1}: ${r.actionVerb}`) },
                          { heading: 'ATS Scores', lines: results.map((r, i) => `#${i+1}: ${r.score}`) },
                        ];
                        exportPdf('writerai-resume-bullets.pdf', formData.jobTitle || 'Resume Bullets', blocks as any);
                      } catch (e) {
                        alert('PDF export failed');
                      }
                    }}>
                      Export PDF
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {results.map((result, index) => (
                    <ResultCard
                      key={index}
                      content={result.text}
                      index={index + 1}
                      metadata={{
                        label: "ATS Score",
                        value: result.score,
                        color: "text-primary"
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Enter your job details to create powerful resume bullets
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ResumeTool;
