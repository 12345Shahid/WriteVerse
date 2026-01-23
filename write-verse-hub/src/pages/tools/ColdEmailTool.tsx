import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { ResultCard } from "@/components/tool/ResultCard";
import { generate, saveResults } from "@/lib/api";
import { exportCsv } from "@/lib/export";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useModel } from "@/context/ModelContext";

/**
 * Cold Email Personalizer Tool
 * 
 * Generates personalized cold email variations with different hooks.
 * 
 * Inputs:
 * - Prospect name
 * - Company
 * - Value proposition
 * - Pain point
 * 
 * Outputs: 3 cold email variations:
 * - Curiosity hook
 * - Pain-point hook
 * - Value-first hook
 * 
 * TODO for backend developer:
 * - API endpoint: POST /api/generate
 * - tool: "cold_email"
 * - Generate 3 variations with different approaches
 */

interface Result {
  text: string;
  hook: string;
  tips?: string[];
  followUps?: string[];
}

const ColdEmailTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedVoiceId } = useBrandVoice();
  const { selectedModelId } = useModel();
  const [formData, setFormData] = useState({
    prospectName: "",
    company: "",
    valueProp: "",
    painPoint: ""
  });
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.prospectName.trim() || !formData.company.trim()) {
      alert("Please fill in prospect name and company");
      return;
    }

    setIsLoading(true);

    console.groupCollapsed("[ColdEmailTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "cold_email",
        inputs: formData,
        outputCount: 3,
        brandVoiceId: selectedVoiceId,
        modelId: selectedModelId,
      });
      const arr = (data?.results ?? []) as Result[];
      console.debug("results.count", Array.isArray(arr) ? arr.length : 0);
      setResults(arr);

      // Auto-save
      try {
        console.groupCollapsed("[ColdEmailTool] Save results");
        await saveResults({ tool_name: "cold_email", input_data: formData, results: arr });
      } catch (e) {
        console.error("[ColdEmailTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[ColdEmailTool] Generation failed", err);
      alert(err?.message || "Failed to generate results. Check console for details.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Cold Email Personalizer"
      description="Craft personalized cold emails that get responses"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-green p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Prospect Details
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prospectName" className="font-bold uppercase text-sm">
                    Prospect Name *
                  </Label>
                  <Input
                    id="prospectName"
                    placeholder="John Smith"
                    value={formData.prospectName}
                    onChange={(e) => setFormData({ ...formData, prospectName: e.target.value })}
                    className="input-brutal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="font-bold uppercase text-sm">
                    Company Name *
                  </Label>
                  <Input
                    id="company"
                    placeholder="TechCorp Inc."
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="input-brutal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valueProp" className="font-bold uppercase text-sm">
                    Your Value Proposition
                  </Label>
                  <Textarea
                    id="valueProp"
                    placeholder="What you can help them achieve..."
                    value={formData.valueProp}
                    onChange={(e) => setFormData({ ...formData, valueProp: e.target.value })}
                    className="input-brutal resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="painPoint" className="font-bold uppercase text-sm">
                    Their Pain Point
                  </Label>
                  <Textarea
                    id="painPoint"
                    placeholder="What problem they're likely facing..."
                    value={formData.painPoint}
                    onChange={(e) => setFormData({ ...formData, painPoint: e.target.value })}
                    className="input-brutal resize-none"
                    rows={3}
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
                  disabled={isLoading || !formData.prospectName.trim() || !formData.company.trim() || isViewer}
                  className={isViewer ? 'opacity-50 cursor-not-allowed' : ''}
                  title={isViewer ? 'Viewers cannot generate content' : ''}
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
                      Generate Cold Emails
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Your Cold Emails</h2>
                  <Button variant="outline" onClick={() => {
                    try {
                      console.groupCollapsed("[ColdEmailTool] Export all");
                      exportCsv(
                        "writerai-cold-emails.csv",
                        results.map((r) => ({ text: r.text, hook: r.hook }))
                      );
                    } catch (e) {
                      console.error("[ColdEmailTool] Export failed", e);
                      alert("Export failed. See console for details.");
                    } finally {
                      console.groupEnd();
                    }
                  }}>
                    Export All
                  </Button>
                </div>

                <div className="space-y-4">
                  {results.map((result, index) => (
                    <div key={index} className="space-y-2">
                      <ResultCard
                        content={result.text}
                        index={index + 1}
                        metadata={{
                          label: "Hook Type",
                          value: result.hook,
                          color: "text-secondary"
                        }}
                      />
                      {(result.tips?.length || result.followUps?.length) && (
                        <div className="ml-12">
                          <button
                            onClick={() => setOpenIdx(openIdx === index ? null : index)}
                            className="border-2 border-black bg-background px-3 py-1 text-xs font-bold uppercase"
                          >
                            {openIdx === index ? 'Hide personalizations' : 'Show personalizations'}
                          </button>
                          {openIdx === index && (
                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                              {result.tips?.length ? (
                                <div className="border-2 border-black bg-muted p-3">
                                  <div className="text-xs font-bold uppercase mb-2">Personalization Tips</div>
                                  <ul className="list-disc pl-5 text-sm font-medium">
                                    {result.tips.map((t, i) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {result.followUps?.length ? (
                                <div className="border-2 border-black bg-muted p-3">
                                  <div className="text-xs font-bold uppercase mb-2">Follow-up Templates</div>
                                  <ul className="list-disc pl-5 text-sm font-medium">
                                    {result.followUps.map((t, i) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Enter prospect details to create personalized cold emails
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ColdEmailTool;
