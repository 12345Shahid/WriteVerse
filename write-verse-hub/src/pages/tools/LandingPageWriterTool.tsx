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

interface LandingPageResult {
  hero_headline: string;
  hero_subheadline: string;
  hero_cta: string;
  sections: { title: string; body: string }[];
  faq_items: { question: string; answer: string }[];
}

const LandingPageWriterTool = () => {
  const { selectedVoiceId } = useBrandVoice();
  const [formData, setFormData] = useState({
    product: "",
    audience: "",
    benefit: "",
    features: "",
    offer: "",
    tone: "persuasive",
  });
  const [result, setResult] = useState<LandingPageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.product.trim() || !formData.audience.trim() || !formData.benefit.trim()) {
      alert("Please fill in product, audience, and main benefit");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[LandingPageWriterTool] Generate");
    const inputs = {
      product: formData.product,
      audience: formData.audience,
      benefit: formData.benefit,
      features: formData.features,
      offer: formData.offer,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "landing_page_writer",
        inputs,
        outputCount: 1,
        brandVoiceId: selectedVoiceId,
      });
      const out = data?.results as LandingPageResult;
      setResult(out);
      try {
        console.groupCollapsed("[LandingPageWriterTool] Save results");
        await saveResults({ tool_name: "landing_page_writer", input_data: inputs, results: out });
      } catch (e) {
        console.error("[LandingPageWriterTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[LandingPageWriterTool] Generation failed", err);
      alert(err?.message || "Failed to generate landing page copy.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Landing Page Writer"
      description="Generate full landing page copy with hero, sections, and FAQs from your product brief."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Landing Page Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="product" className="font-bold uppercase text-sm">
                    Product / Offer *
                  </Label>
                  <Textarea
                    id="product"
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    rows={3}
                    className="input-brutal resize-none"
                    placeholder="Describe what you're selling and why it matters"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience" className="font-bold uppercase text-sm">
                    Target Audience *
                  </Label>
                  <Input
                    id="audience"
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., indie hackers, B2B marketers, HR leaders"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="benefit" className="font-bold uppercase text-sm">
                    Main Benefit / Promise *
                  </Label>
                  <Textarea
                    id="benefit"
                    value={formData.benefit}
                    onChange={(e) => setFormData({ ...formData, benefit: e.target.value })}
                    rows={3}
                    className="input-brutal resize-none"
                    placeholder="What outcome should the headline emphasize?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="features" className="font-bold uppercase text-sm">
                    Key Features (optional)
                  </Label>
                  <Textarea
                    id="features"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="Bullet-style list of features or sections you want covered"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer" className="font-bold uppercase text-sm">
                    Offer & Pricing (optional)
                  </Label>
                  <Input
                    id="offer"
                    value={formData.offer}
                    onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                    className="input-brutal"
                    placeholder="E.g., Free trial, one-time fee, subscription pricing"
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
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={
                    isLoading ||
                    !formData.product.trim() ||
                    !formData.audience.trim() ||
                    !formData.benefit.trim()
                  }
                  className="w-full bg-black text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Writing Landing Page...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Landing Page
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {result ? (
              <article className="border-4 border-black bg-card p-6 shadow-brutal space-y-4">
                {(result.hero_headline || result.hero_subheadline || result.hero_cta) && (
                  <header className="space-y-2">
                    {result.hero_headline && (
                      <h2 className="text-3xl font-bold">{result.hero_headline}</h2>
                    )}
                    {result.hero_subheadline && (
                      <p className="text-lg text-muted-foreground">{result.hero_subheadline}</p>
                    )}
                    {result.hero_cta && (
                      <p className="text-sm font-semibold">Primary CTA: {result.hero_cta}</p>
                    )}
                  </header>
                )}
                {result.sections && result.sections.length > 0 && (
                  <div className="space-y-4">
                    {result.sections.map((s, i) => (
                      <section key={i} className="space-y-1">
                        {s.title && <h3 className="text-lg font-bold">{s.title}</h3>}
                        <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                      </section>
                    ))}
                  </div>
                )}
                {result.faq_items && result.faq_items.length > 0 && (
                  <section className="border-t-2 border-black pt-4 mt-2">
                    <h3 className="text-lg font-bold mb-2">FAQ</h3>
                    <div className="space-y-2">
                      {result.faq_items.map((f, i) => (
                        <div key={i} className="border-2 border-black bg-background p-3">
                          <div className="font-bold">Q: {f.question}</div>
                          <div className="text-sm mt-1">A: {f.answer}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </article>
            ) : (
              <div className="border-4 border-black bg-muted p-12 text-center shadow-brutal">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Write High-Converting Landing Pages</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Provide your product details and audience, then generate structured landing page copy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default LandingPageWriterTool;
