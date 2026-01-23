import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { ResultCard } from "@/components/tool/ResultCard";
import { generate, saveResults } from "@/lib/api";
import { exportCsv } from "@/lib/export";
import { Button } from "@/components/ui/button-brutal";
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
 * LinkedIn Post Generator Tool
 * 
 * Creates engaging LinkedIn posts that boost professional brand.
 * 
 * Inputs:
 * - Topic
 * - Industry
 * - Preferred tone (motivational/educational/entertaining/controversial)
 * 
 * Outputs: 3 LinkedIn post variations including:
 * - Hook (first line to stop scroll)
 * - Body (storytelling or insight)
 * - CTA (call-to-action)
 * - Hashtag suggestions
 * - Emoji recommendations
 * 
 * TODO for backend developer:
 * - tool: "linkedin"
 * - Generate posts with optimal formatting
 * - Include engagement prediction
 * - NO social media auth needed (user copies/pastes manually)
 */

interface Result {
  text: string;
  engagementScore: string;
  hashtags: string;
  emojiSuggestions?: string[];
}

const LinkedInTool = () => {
  const { canGenerate, isViewer } = usePermissions();
  const { selectedVoiceId } = useBrandVoice();
  const { selectedModelId } = useModel();
  const [formData, setFormData] = useState({
    topic: "",
    industry: "technology",
    tone: "educational"
  });
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const applyEmojis = (idx: number) => {
    const r = results[idx];
    const em = (r.emojiSuggestions || []).join(' ');
    if (!em) return;
    const updated = [...results];
    // Prepend emojis to first line
    const parts = r.text.split('\n');
    parts[0] = `${em} ${parts[0]}`;
    updated[idx] = { ...r, text: parts.join('\n') };
    setResults(updated);
  };
  const scoreToPct = (s: string) => {
    const x = (s || '').toLowerCase();
    if (x.includes('very high')) return 90;
    if (x.includes('high')) return 75;
    if (x.includes('medium')) return 60;
    return 50;
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      alert('Viewers cannot generate content');
      return;
    }
    if (!formData.topic.trim()) {
      alert("Please enter a topic");
      return;
    }

    setIsLoading(true);

    console.groupCollapsed("[LinkedInTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "linkedin",
        inputs: formData,
        outputCount: 3,
        brandVoiceId: selectedVoiceId,
        modelId: selectedModelId,
      });
      const arr = (data?.results ?? []) as Result[];
      console.debug("results.count", Array.isArray(arr) ? arr.length : 0);
      setResults(arr);

      try {
        console.groupCollapsed("[LinkedInTool] Save results");
        await saveResults({ tool_name: "linkedin", input_data: formData, results: arr });
      } catch (e) {
        console.error("[LinkedInTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[LinkedInTool] Generation failed", err);
      alert(err?.message || "Failed to generate results. Check console for details.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="LinkedIn Post Generator"
      description="Create engaging LinkedIn posts that boost your professional brand"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-orange p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Post Details
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Topic *
                  </Label>
                  <Textarea
                    id="topic"
                    placeholder="What do you want to write about?"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="input-brutal resize-none"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry" className="font-bold uppercase text-sm">
                    Industry
                  </Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => setFormData({ ...formData, industry: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="hr">Human Resources</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone" className="font-bold uppercase text-sm">
                    Tone
                  </Label>
                  <Select
                    value={formData.tone}
                    onValueChange={(value) => setFormData({ ...formData, tone: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motivational">Motivational</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="entertaining">Entertaining</SelectItem>
                      <SelectItem value="controversial">Controversial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isViewer && (
                  <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded flex items-start gap-2">
                    <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-700"><strong>Viewer:</strong> You cannot generate content</p>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !formData.topic.trim() || isViewer}
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
                      Generate LinkedIn Posts
                    </>
                  )}
                </Button>

                <div className="border-3 border-black bg-background p-4">
                  <p className="text-xs font-bold uppercase mb-2">📋 How to use</p>
                  <p className="text-sm font-medium">
                    Copy the post you like and paste it into LinkedIn. No login required!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Your LinkedIn Posts</h2>
                  <Button variant="outline" onClick={() => {
                    try {
                      console.groupCollapsed("[LinkedInTool] Export all");
                      exportCsv(
                        "writerai-linkedin-posts.csv",
                        results.map((r) => ({ text: r.text, engagementScore: r.engagementScore, hashtags: r.hashtags, emojiSuggestions: (r.emojiSuggestions || []).join(' ') }))
                      );
                    } catch (e) {
                      console.error("[LinkedInTool] Export failed", e);
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
                          label: "Engagement",
                          value: result.engagementScore,
                          color: "text-primary"
                        }}
                      />
                      <div className="ml-12 grid md:grid-cols-2 gap-3">
                        <div className="border-2 border-black bg-muted p-3">
                          <p className="text-xs font-bold uppercase mb-1">Suggested Hashtags</p>
                          <p className="text-sm font-medium">{result.hashtags}</p>
                        </div>
                        {result.emojiSuggestions?.length ? (
                          <div className="border-2 border-black bg-muted p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold uppercase">Emoji Suggestions</p>
                              <button
                                onClick={() => applyEmojis(index)}
                                className="border-2 border-black bg-background px-2 py-1 text-xs font-bold uppercase"
                              >
                                Apply emojis
                              </button>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-lg">
                              {result.emojiSuggestions.map((e, i) => (
                                <span key={i}>{e}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="md:col-span-2 border-2 border-black bg-background p-3">
                          <div className="text-xs font-bold uppercase mb-2">Engagement Gauge</div>
                          <div className="w-full h-3 border-2 border-black bg-muted relative">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${scoreToPct(result.engagementScore)}%` }}
                            ></div>
                          </div>
                        </div>
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
                  Enter your topic to create engaging LinkedIn posts
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default LinkedInTool;
