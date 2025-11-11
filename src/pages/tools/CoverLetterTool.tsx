import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";

interface CoverOut { text: string; atsScore: string; openingHook: string; closing: string; }

const CoverLetterTool = () => {
  const [formData, setFormData] = useState({ jobTitle: "", company: "", achievement: "", hiringManager: "" });
  const [result, setResult] = useState<CoverOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.jobTitle.trim() || !formData.company.trim()) { alert("Please fill job title and company"); return; }
    setIsLoading(true);
    console.groupCollapsed("[CoverLetterTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({ tool: "cover_letter", inputs: formData, outputCount: 1 });
      const out = (data?.results ?? null) as any;
      setResult(out as CoverOut);
      try {
        console.groupCollapsed("[CoverLetterTool] Save results");
        await saveResults({ tool_name: "cover_letter", input_data: formData, results: out });
      } catch (e) { console.error("[CoverLetterTool] Save failed", e); } finally { console.groupEnd(); }
    } catch (err: any) {
      console.error("[CoverLetterTool] Generation failed", err);
      alert(err?.message || "Failed to generate cover letter.");
    } finally { console.groupEnd(); setIsLoading(false); }
  };

  return (
    <ToolLayout title="Cover Letter Generator" description="Create a tailored cover letter with ATS score and polished sections">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-pink p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="h-6 w-6"/>Details</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Job Title *</Label>
                  <Input value={formData.jobTitle} onChange={(e)=>setFormData({...formData, jobTitle:e.target.value})} className="input-brutal"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Company *</Label>
                  <Input value={formData.company} onChange={(e)=>setFormData({...formData, company:e.target.value})} className="input-brutal"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Key Achievement</Label>
                  <Textarea value={formData.achievement} onChange={(e)=>setFormData({...formData, achievement:e.target.value})} rows={3} className="input-brutal resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Hiring Manager (optional)</Label>
                  <Input value={formData.hiringManager} onChange={(e)=>setFormData({...formData, hiringManager:e.target.value})} className="input-brutal"/>
                </div>
                <Button onClick={handleGenerate} disabled={isLoading || !formData.jobTitle.trim() || !formData.company.trim()} className="w-full bg-black text-white" size="lg">
                  {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Generating...</>) : (<><Sparkles className="mr-2 h-5 w-5"/>Generate Cover Letter</>)}
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-4">
                <div className="border-4 border-black bg-card p-6 shadow-brutal whitespace-pre-wrap">{result.text}</div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">ATS Score</div><div className="text-lg font-bold">{result.atsScore}</div></div>
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Opening Hook</div><div className="text-sm font-medium">{result.openingHook}</div></div>
                  <div className="border-4 border-black bg-card p-4"><div className="text-xs font-bold uppercase">Closing</div><div className="text-sm font-medium">{result.closing}</div></div>
                </div>
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground"/>
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">Fill in role and company details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default CoverLetterTool;
