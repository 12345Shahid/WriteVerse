import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { ResultCard } from "@/components/tool/ResultCard";
import { generate, saveResults } from "@/lib/api";
import { exportCsv } from "@/lib/export";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { useBrandVoice } from "@/context/BrandVoiceContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useModel } from "@/context/ModelContext";

/**
 * Product Description Writer Tool
 * 
 * Generates compelling product descriptions in multiple tones.
 * 
 * Inputs:
 * - Product name
 * - Key features
 * - Target market
 * - Price point
 * 
 * Outputs: 3 descriptions in different tones:
 * - Casual/friendly
 * - Professional
 * - Luxury/premium
 * 
 * TODO for backend developer:
 * - tool: "product_description"
 * - Generate SEO-optimized descriptions
 * - Include benefit highlighting
 * - Add CTA suggestions
 */

interface Result {
  text: string;
  tone: string;
  seoKeywords?: string[];
  metaDescription?: string;
  cta?: string;
  bullets?: string[];
}

const ProductDescriptionTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedVoiceId } = useBrandVoice();
  const { selectedModelId } = useModel();
  const [formData, setFormData] = useState({
    productName: "",
    features: "",
    targetMarket: "general",
    pricePoint: "mid",
    bulletMode: false,
  });
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.productName.trim() || !formData.features.trim()) {
      alert("Please fill in product name and features");
      return;
    }

    setIsLoading(true);

    console.groupCollapsed("[ProductDescriptionTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "product_description",
        inputs: formData,
        outputCount: 3,
        brandVoiceId: selectedVoiceId,
        modelId: selectedModelId,
      });
      const arr = (data?.results ?? []) as Result[];
      console.debug("results.count", Array.isArray(arr) ? arr.length : 0);
      setResults(arr);

      try {
        console.groupCollapsed("[ProductDescriptionTool] Save results");
        await saveResults({ tool_name: "product_description", input_data: formData, results: arr });
      } catch (e) {
        console.error("[ProductDescriptionTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[ProductDescriptionTool] Generation failed", err);
      alert(err?.message || "Failed to generate results. Check console for details.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Product Description Writer"
      description="Write compelling product descriptions that convert browsers to buyers"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Product Details
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="productName" className="font-bold uppercase text-sm">
                    Product Name *
                  </Label>
                  <Input
                    id="productName"
                    placeholder="E.g., SmartWatch Pro 2000"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    className="input-brutal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="features" className="font-bold uppercase text-sm">
                    Key Features *
                  </Label>
                  <Textarea
                    id="features"
                    placeholder="List main features and benefits..."
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    className="input-brutal resize-none"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetMarket" className="font-bold uppercase text-sm">
                    Target Market
                  </Label>
                  <Select
                    value={formData.targetMarket}
                    onValueChange={(value) => setFormData({ ...formData, targetMarket: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Consumers</SelectItem>
                      <SelectItem value="professionals">Professionals</SelectItem>
                      <SelectItem value="tech-enthusiasts">Tech Enthusiasts</SelectItem>
                      <SelectItem value="fitness">Fitness Enthusiasts</SelectItem>
                      <SelectItem value="luxury">Luxury Buyers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricePoint" className="font-bold uppercase text-sm">
                    Price Point
                  </Label>
                  <Select
                    value={formData.pricePoint}
                    onValueChange={(value) => setFormData({ ...formData, pricePoint: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget ($0-$50)</SelectItem>
                      <SelectItem value="mid">Mid-Range ($50-$200)</SelectItem>
                      <SelectItem value="premium">Premium ($200-$500)</SelectItem>
                      <SelectItem value="luxury">Luxury ($500+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="bulletMode"
                    type="checkbox"
                    checked={formData.bulletMode}
                    onChange={(e) => setFormData({ ...formData, bulletMode: e.target.checked })}
                  />
                  <Label htmlFor="bulletMode" className="font-bold uppercase text-sm">
                    Bullet-point output mode
                  </Label>
                </div>

                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.productName.trim() || !formData.features.trim() || isViewer}
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
                      Generate Descriptions
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
                  <h2 className="text-2xl font-bold">Product Descriptions</h2>
                  <Button variant="outline" onClick={() => {
                    try {
                      console.groupCollapsed("[ProductDescriptionTool] Export all");
                      exportCsv(
                        "writerai-product-descriptions.csv",
                        results.map((r) => ({ text: r.text, tone: r.tone }))
                      );
                    } catch (e) {
                      console.error("[ProductDescriptionTool] Export failed", e);
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
                    <div key={index} className="space-y-3">
                      <ResultCard
                        content={result.text}
                        index={index + 1}
                        metadata={{
                          label: "Tone",
                          value: result.tone,
                          color: "text-warning"
                        }}
                      />
                      <div className="ml-12 grid md:grid-cols-2 gap-3">
                        {result.seoKeywords?.length ? (
                          <div className="border-2 border-black bg-muted p-3">
                            <div className="text-xs font-bold uppercase mb-2">SEO Keywords</div>
                            <div className="flex flex-wrap gap-2">
                              {result.seoKeywords.map((k, i) => (
                                <span key={i} className="border-2 border-black bg-background px-2 py-1 text-xs font-bold uppercase">{k}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {(result.metaDescription || result.cta) ? (
                          <div className="border-2 border-black bg-muted p-3">
                            {result.metaDescription ? (
                              <div className="mb-2">
                                <div className="text-xs font-bold uppercase mb-1">Meta Description</div>
                                <div className="text-sm font-medium">{result.metaDescription}</div>
                              </div>
                            ) : null}
                            {result.cta ? (
                              <div>
                                <div className="text-xs font-bold uppercase mb-1">CTA</div>
                                <div className="text-sm font-bold">{result.cta}</div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {result.bullets?.length ? (
                          <div className="md:col-span-2 border-2 border-black bg-muted p-3">
                            <div className="text-xs font-bold uppercase mb-2">Bullet Listing</div>
                            <ul className="list-disc pl-5 text-sm font-medium">
                              {result.bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Ready to Generate</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Enter product details to create compelling descriptions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ProductDescriptionTool;
