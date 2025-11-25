import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";

interface SocialResult { text: string }

const modes = [
  { value: "post", label: "Full Post" },
  { value: "caption", label: "Caption" },
  { value: "hook", label: "Hook / First Line" },
  { value: "hashtag_block", label: "Hashtag Block" },
  { value: "bio", label: "Profile Bio" },
];

const platforms = [
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
];

const SocialHelperTool = () => {
  const [formData, setFormData] = useState({
    mode: "post",
    platform: "twitter",
    topic: "",
    audience: "",
    cta: "",
    tone: "neutral",
    outputCount: 3,
  });
  const [results, setResults] = useState<SocialResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      alert("Please enter a topic or idea for the content");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[SocialHelperTool] Generate");
    const inputs = {
      mode: formData.mode,
      platform: formData.platform,
      topic: formData.topic,
      audience: formData.audience,
      cta: formData.cta,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "social_helper",
        inputs,
        outputCount: formData.outputCount,
      });
      const out = (data?.results ?? []) as SocialResult[];
      setResults(out);
      try {
        console.groupCollapsed("[SocialHelperTool] Save results");
        await saveResults({ tool_name: "social_helper", input_data: inputs, results: out });
      } catch (e) {
        console.error("[SocialHelperTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[SocialHelperTool] Generation failed", err);
      alert(err?.message || "Failed to generate social content.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Social Content Helper"
      description="Generate posts, captions, hooks, bios, and hashtag blocks for all your social platforms."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Social Inputs
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
                  <Label className="font-bold uppercase text-sm">Platform</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(v) => setFormData({ ...formData, platform: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Topic / Idea *
                  </Label>
                  <Textarea
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    rows={4}
                    className="input-brutal resize-none"
                    placeholder="What is this post about? Product launch, tip, story, announcement?"
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
                    placeholder="e.g. indie hackers, marketers in India, busy parents"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cta" className="font-bold uppercase text-sm">
                    Call to Action (optional)
                  </Label>
                  <Input
                    id="cta"
                    value={formData.cta}
                    onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                    className="input-brutal"
                    placeholder="e.g. sign up, comment, share, click link, DM"
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
                      <SelectItem value="playful">Playful</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
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

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.topic.trim()}
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
                <h3 className="text-2xl font-bold mb-2">Ready to Fill Your Content Calendar</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Pick a platform and mode, describe your idea, and generate scroll-stopping content.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default SocialHelperTool;
