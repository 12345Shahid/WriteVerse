import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useModel } from "@/context/ModelContext";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";

interface CopyResult { text: string }

const modes = [
  { value: "aida", label: "AIDA Framework" },
  { value: "pas", label: "PAS Framework" },
  { value: "pbs", label: "Pain–Benefit–Solution" },
  { value: "sales_blurb", label: "Short Sales Copy" },
  { value: "tagline", label: "Tagline / Slogan" },
];

const CopyHelperTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedModelId } = useModel();
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    mode: "aida",
    product: "",
    audience: "",
    offer: "",
    painPoints: "",
    tone: "neutral",
    outputCount: 3,
  });
  const [results, setResults] = useState<CopyResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.product.trim()) {
      alert("Please describe your product or offer");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[CopyHelperTool] Generate");
    const inputs = {
      mode: formData.mode,
      product: formData.product,
      audience: formData.audience,
      offer: formData.offer,
      painPoints: formData.painPoints,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "copy_helper",
        inputs,
        outputCount: formData.outputCount,
        modelId: selectedModelId,
        brandVoiceId: selectedVoiceId,
      });
      const out = (data?.results ?? []) as CopyResult[];
      setResults(out);
      try {
        console.groupCollapsed("[CopyHelperTool] Save results");
        await saveResults({ tool_name: "copy_helper", input_data: inputs, results: out });
      } catch (e) {
        console.error("[CopyHelperTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[CopyHelperTool] Generation failed", err);
      alert(err?.message || "Failed to generate copy.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Copywriting Helper"
      description="Generate AIDA, PAS, sales blurbs, and taglines for your product in a few clicks."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Copy Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Mode</Label>
                  <Select
                    value={formData.mode}
                    onValueChange={(v) => setFormData({ ...formData, mode: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modes.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product" className="font-bold uppercase text-sm">
                    Product / Offer *
                  </Label>
                  <Textarea
                    id="product"
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="Describe what you're selling, key features, and value."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience" className="font-bold uppercase text-sm">
                    Audience (optional)
                  </Label>
                  <Input
                    id="audience"
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="input-brutal"
                    placeholder="e.g. freelance designers, SaaS founders, DTC marketers"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer" className="font-bold uppercase text-sm">
                    Main Benefit / Offer (optional)
                  </Label>
                  <Textarea
                    id="offer"
                    value={formData.offer}
                    onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                    rows={3}
                    className="input-brutal resize-none"
                    placeholder="What outcome or promise should the copy emphasize?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pain" className="font-bold uppercase text-sm">
                    Pain Points (optional)
                  </Label>
                  <Textarea
                    id="pain"
                    value={formData.painPoints}
                    onChange={(e) => setFormData({ ...formData, painPoints: e.target.value })}
                    rows={3}
                    className="input-brutal resize-none"
                    placeholder="List the key problems or objections your audience has."
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
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="bold">Bold / Direct Response</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="count" className="font-bold uppercase text-sm">
                    Variations
                  </Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.outputCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        outputCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                      })
                    }
                    className="input-brutal w-24"
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
                  disabled={isLoading || !formData.product.trim() || isViewer}
                  className={`w-full bg-black text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isViewer ? 'Viewers cannot generate content' : ''}
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
                      Generate Variations
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((r, idx) => (
                  <div key={idx} className="border-4 border-black bg-card p-4 shadow-brutal">
                    <div className="text-xs font-bold uppercase mb-2">Variation #{idx + 1}</div>
                    <p className="whitespace-pre-wrap font-medium">{r.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Ready to Write High-Converting Copy</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Pick a mode, describe your product, and generate on-brand marketing copy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default CopyHelperTool;
