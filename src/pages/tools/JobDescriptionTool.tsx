import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { generate, saveResults } from "@/lib/api";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { exportPdf } from "@/lib/export";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";

/**
 * Job Description Generator Tool
 * 
 * Generates complete job postings with compliance-friendly language.
 * 
 * Inputs:
 * - Role title
 * - Key responsibilities
 * - Company culture
 * - Experience level
 * 
 * Output: Full job posting including:
 * - Role summary
 * - Responsibilities (5-8 bullets)
 * - Required qualifications
 * - Nice-to-have skills
 * - Salary range suggestions
 * - Equal opportunity statement
 * 
 * TODO for backend developer:
 * - tool: "job_description"
 * - Generate ADA/EEOC compliant language
 * - Include salary benchmarking data
 */

const JobDescriptionTool = () => {
  const [formData, setFormData] = useState({
    roleTitle: "",
    responsibilities: "",
    culture: "",
    experienceLevel: "mid"
  });
  const [result, setResult] = useState<{
    roleSummary: string;
    responsibilities: string[];
    requiredQualifications: string[];
    niceToHave: string[];
    salaryRange: string;
    culture: string;
    eeoStatement: string;
    complianceNotes: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!formData.roleTitle.trim() || !formData.responsibilities.trim()) {
      alert("Please fill in role title and responsibilities");
      return;
    }

    setIsLoading(true);

    console.groupCollapsed("[JobDescriptionTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "job_description",
        inputs: formData,
        outputCount: 1,
      });
      const obj = (data?.results ?? null) as any;
      console.debug("has.sections", !!obj && typeof obj === 'object');
      setResult(obj);
      try {
        console.groupCollapsed("[JobDescriptionTool] Save results");
        await saveResults({ tool_name: "job_description", input_data: formData, results: obj });
      } catch (e) {
        console.error("[JobDescriptionTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[JobDescriptionTool] Generation failed", err);
      alert(err?.message || "Failed to generate results. Check console for details.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push("Role Summary:");
    lines.push(result.roleSummary);
    lines.push("");
    lines.push("Responsibilities:");
    result.responsibilities.forEach((x) => lines.push("- " + x));
    lines.push("");
    lines.push("Required Qualifications:");
    result.requiredQualifications.forEach((x) => lines.push("- " + x));
    if (result.niceToHave?.length) {
      lines.push("");
      lines.push("Nice to Have:");
      result.niceToHave.forEach((x) => lines.push("- " + x));
    }
    lines.push("");
    lines.push("Salary Range:");
    lines.push(result.salaryRange);
    lines.push("");
    lines.push("Culture:");
    lines.push(result.culture);
    lines.push("");
    lines.push("Equal Opportunity Statement:");
    lines.push(result.eeoStatement);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolLayout
      title="Job Description Generator"
      description="Generate complete job postings with compliance-friendly language"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-purple p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Role Details
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="roleTitle" className="font-bold uppercase text-sm">
                    Role Title *
                  </Label>
                  <Input
                    id="roleTitle"
                    placeholder="E.g., Senior Software Engineer"
                    value={formData.roleTitle}
                    onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                    className="input-brutal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsibilities" className="font-bold uppercase text-sm">
                    Key Responsibilities *
                  </Label>
                  <Textarea
                    id="responsibilities"
                    placeholder="List main responsibilities (one per line)..."
                    value={formData.responsibilities}
                    onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                    className="input-brutal resize-none"
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="culture" className="font-bold uppercase text-sm">
                    Company Culture
                  </Label>
                  <Textarea
                    id="culture"
                    placeholder="Describe your company culture and values..."
                    value={formData.culture}
                    onChange={(e) => setFormData({ ...formData, culture: e.target.value })}
                    className="input-brutal resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experienceLevel" className="font-bold uppercase text-sm">
                    Experience Level
                  </Label>
                  <Select
                    value={formData.experienceLevel}
                    onValueChange={(value) => setFormData({ ...formData, experienceLevel: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                      <SelectItem value="mid">Mid Level (3-5 years)</SelectItem>
                      <SelectItem value="senior">Senior Level (5+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.roleTitle.trim() || !formData.responsibilities.trim()}
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
                      Generate Job Description
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {result ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Your Job Description</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCopy}>
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? "Copied!" : "Copy All"}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      try {
                        exportPdf('writerai-job-description.pdf', formData.roleTitle || 'Job Description', [
                          { heading: 'Role Summary', lines: [result.roleSummary] },
                          { heading: 'Responsibilities', lines: result.responsibilities || [] },
                          { heading: 'Required Qualifications', lines: result.requiredQualifications || [] },
                          { heading: 'Nice to Have', lines: result.niceToHave || [] },
                          { heading: 'Salary Range', lines: [result.salaryRange] },
                          { heading: 'Culture', lines: [result.culture] },
                          { heading: 'Equal Opportunity Statement', lines: [result.eeoStatement] },
                          { heading: 'Compliance Notes', lines: result.complianceNotes || [] },
                        ]);
                      } catch (e) {
                        alert('PDF export failed');
                      }
                    }}>Export PDF</Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 border-4 border-black bg-card p-6 shadow-brutal space-y-4">
                    <div>
                      <div className="text-sm font-bold uppercase mb-1">Role Summary</div>
                      <div className="text-sm font-medium whitespace-pre-wrap">{result.roleSummary}</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase mb-1">Responsibilities</div>
                      <ul className="list-disc pl-5 text-sm font-medium">
                        {result.responsibilities?.map((x, i) => (<li key={i}>{x}</li>))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase mb-1">Required Qualifications</div>
                      <ul className="list-disc pl-5 text-sm font-medium">
                        {result.requiredQualifications?.map((x, i) => (<li key={i}>{x}</li>))}
                      </ul>
                    </div>
                    {result.niceToHave?.length ? (
                      <div>
                        <div className="text-sm font-bold uppercase mb-1">Nice to Have</div>
                        <ul className="list-disc pl-5 text-sm font-medium">
                          {result.niceToHave?.map((x, i) => (<li key={i}>{x}</li>))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <div className="text-sm font-bold uppercase mb-1">Salary Range</div>
                      <div className="text-sm font-medium">{result.salaryRange}</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase mb-1">Culture</div>
                      <div className="text-sm font-medium whitespace-pre-wrap">{result.culture}</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase mb-1">Equal Opportunity Statement</div>
                      <div className="text-sm font-medium whitespace-pre-wrap">{result.eeoStatement}</div>
                    </div>
                  </div>
                  <div className="border-4 border-black bg-muted p-6 shadow-brutal">
                    <div className="text-sm font-bold uppercase mb-2">Compliance Notes</div>
                    {result.complianceNotes?.length ? (
                      <ul className="list-disc pl-5 text-sm font-medium">
                        {result.complianceNotes.map((x, i) => (<li key={i}>{x}</li>))}
                      </ul>
                    ) : (
                      <div className="text-sm font-medium text-muted-foreground">No notes</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Enter role details to create a complete job description
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default JobDescriptionTool;
