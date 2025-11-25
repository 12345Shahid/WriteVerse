import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { ResultCard } from "@/components/tool/ResultCard";
import { generate, saveResults } from "@/lib/api";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useBrandVoice } from "@/context/BrandVoiceContext";

interface AdRow { text: string; platform: string; predictedCtr: string; trigger: string; charCount: number; }

const SocialAdTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    productName: "",
    audience: "millennials",
    platform: "facebook",
    goal: "conversions",
  });
  const [results, setResults] = useState<AdRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.productName.trim()) {
      alert("Please enter a product or service name");
      return;
    }
    setIsLoading(true);
    console.groupCollapsed("[SocialAdTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "social_ad",
        inputs: formData,
        outputCount: 5,
        brandVoiceId: selectedVoiceId
      });
      const arr = (data?.results ?? []) as AdRow[];
      console.debug("results.count", Array.isArray(arr) ? arr.length : 0);
      setResults(arr);
      try {
        console.groupCollapsed("[SocialAdTool] Save results");
        await saveResults({ tool_name: "social_ad", input_data: formData, results: arr });
      } catch (e) {
        console.error("[SocialAdTool] Save failed", e);
      } finally { console.groupEnd(); }
    } catch (err: any) {
      console.error("[SocialAdTool] Generation failed", err);
      alert(err?.message || "Failed to generate results.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout title="Social Media Ad Copy" description="Generate high-converting ad variations by platform">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="h-6 w-6"/>Ad Inputs</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="productName" className="font-bold uppercase text-sm">Product/Service *</Label>
                  <Input id="productName" value={formData.productName} onChange={(e)=>setFormData({...formData, productName:e.target.value})} className="input-brutal" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Audience</Label>
                  <Select value={formData.audience} onValueChange={(v)=>setFormData({...formData, audience:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="millennials">Millennials</SelectItem>
                      <SelectItem value="professionals">Professionals</SelectItem>
                      <SelectItem value="parents">Parents</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Platform</Label>
                  <Select value={formData.platform} onValueChange={(v)=>setFormData({...formData, platform:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Goal</Label>
                  <Select value={formData.goal} onValueChange={(v)=>setFormData({...formData, goal:v})}>
                    <SelectTrigger className="input-brutal"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="awareness">Awareness</SelectItem>
                      <SelectItem value="clicks">Clicks</SelectItem>
                      <SelectItem value="conversions">Conversions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerate} disabled={isLoading || !formData.productName.trim()} className="w-full bg-black text-white" size="lg">
                  {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Generating...</>) : (<><Sparkles className="mr-2 h-5 w-5"/>Generate Ads</>)}
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {results.length>0 ? (
              <div className="space-y-4">
                {results.map((r, i)=> (
                  <ResultCard key={i} content={r.text} index={i+1} metadata={{ label: r.platform, value: `${r.predictedCtr} • ${r.trigger}`, color: "text-primary" }} />
                ))}
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground"/>
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">Enter product and audience to create platform-specific ads</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default SocialAdTool;
