import { useState } from "react";
import { generate, saveResults, createAbTest, setAbTestWinner } from "@/lib/api";
import { exportCsv } from "@/lib/export";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { ResultCard } from "@/components/tool/ResultCard";
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
import { Loader2, Sparkles } from "lucide-react";

/**
 * Email Subject Line Generator Tool
 * 
 * The primary tool of WriterAI platform.
 * Generates 10 email subject line variations with psychology insights.
 * 
 * Features:
 * - Topic input
 * - Audience type selection
 * - Goal selection (open rate, clicks, conversions)
 * - Generates 10 variations
 * - Shows predicted open rate
 * - Displays psychology trigger used
 * 
 * TODO for backend developer:
 * 1. Create API endpoint: POST /api/generate
 * 2. Integrate with Google Gemini API:
 *    - Use gemini-2.5-flash model for cost efficiency
 *    - Implement the prompt template below
 *    - Parse and return structured results
 * 3. Implement token counting and limiting
 * 4. Add rate limiting (prevent abuse)
 * 5. Save results to database if user is authenticated
 * 6. Track usage analytics
 * 
 * API Request Format:
 * {
 *   "tool": "email_subject",
 *   "inputs": {
 *     "topic": "New product launch",
 *     "audience": "millennials",
 *     "goal": "open_rate"
 *   },
 *   "outputCount": 10
 * }
 * 
 * Prompt Template for Gemini:
 * "Generate 10 email subject lines for: {topic}
 *  Target audience: {audience}
 *  Goal: Maximize {goal}
 *  
 *  For each subject line, provide:
 *  1. The subject line text
 *  2. Predicted open rate percentage
 *  3. Psychology trigger used (curiosity, urgency, social proof, etc.)
 *  4. Character count
 *  
 *  Return as JSON array with structure:
 *  [{
 *    "text": "subject line",
 *    "openRate": "45%",
 *    "trigger": "Curiosity",
 *    "charCount": 42
 *  }]"
 */

interface Result {
  text: string;
  openRate: string;
  trigger: string;
  charCount: number;
}

const EmailSubjectTool = () => {
  const [formData, setFormData] = useState({
    topic: "",
    audience: "general",
    goal: "open_rate"
  });
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pickA, setPickA] = useState<number | null>(null);
  const [pickB, setPickB] = useState<number | null>(null);
  const [abTestId, setAbTestId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      alert("Please enter an email topic");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[EmailSubjectTool] Generate");
    console.debug("inputs", formData);
    try {
      const data = await generate({
        tool: "email_subject",
        inputs: formData,
        outputCount: 10,
      });
      console.debug("results.count", Array.isArray(data?.results) ? data.results.length : 0);
      setResults((data?.results ?? []) as Result[]);
      setPickA(null);
      setPickB(null);
      setAbTestId(null);
      // Auto-save generated results
      try {
        console.groupCollapsed("[EmailSubjectTool] Save results");
        const saved = await saveResults({
          tool_name: "email_subject",
          input_data: formData,
          results: data?.results ?? [],
        });
        console.debug("saved.id", saved?.saved?.id);
      } catch (e) {
        console.error("[EmailSubjectTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[EmailSubjectTool] Generation failed", err);
      alert(err?.message || "Failed to generate results. Check console for details.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Email Subject Line Generator"
      description="Generate 10 high-converting email subject lines with psychology insights"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Input Form - Left Column */}
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-blue p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Input Details
              </h2>

              <div className="space-y-6">
                {/* Topic Input */}
                <div className="space-y-2">
                  <Label htmlFor="topic" className="font-bold uppercase text-sm">
                    Email Topic *
                  </Label>
                  <Textarea
                    id="topic"
                    placeholder="E.g., New product launch, Summer sale, Webinar invitation..."
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="input-brutal resize-none"
                    rows={4}
                  />
                  <p className="text-xs font-medium opacity-75">
                    Describe what your email is about
                  </p>
                </div>

                {/* Audience Selection */}
                <div className="space-y-2">
                  <Label htmlFor="audience" className="font-bold uppercase text-sm">
                    Target Audience
                  </Label>
                  <Select
                    value={formData.audience}
                    onValueChange={(value) => setFormData({ ...formData, audience: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="millennials">Millennials</SelectItem>
                      <SelectItem value="gen-z">Gen Z</SelectItem>
                      <SelectItem value="professionals">Professionals</SelectItem>
                      <SelectItem value="entrepreneurs">Entrepreneurs</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Goal Selection */}
                <div className="space-y-2">
                  <Label htmlFor="goal" className="font-bold uppercase text-sm">
                    Primary Goal
                  </Label>
                  <Select
                    value={formData.goal}
                    onValueChange={(value) => setFormData({ ...formData, goal: value })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open_rate">Maximize Open Rate</SelectItem>
                      <SelectItem value="click_rate">Maximize Click Rate</SelectItem>
                      <SelectItem value="conversions">Maximize Conversions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate Button */}
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
                      Generate 10 Subject Lines
                    </>
                  )}
                </Button>

                {/* Cost Info */}
                <div className="border-3 border-black bg-background p-4">
                  <p className="text-xs font-bold uppercase mb-1">Token Cost</p>
                  <p className="text-sm font-medium">
                    ~50 tokens per generation
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Results - Right Column */}
          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Generated Subject Lines</h2>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        console.groupCollapsed("[EmailSubjectTool] Export all");
                        exportCsv(
                          "writerai-email-subjects.csv",
                          results.map((r) => ({
                            text: r.text,
                            openRate: r.openRate,
                            trigger: r.trigger,
                            charCount: r.charCount,
                          }))
                        );
                      } catch (e) {
                        console.error("[EmailSubjectTool] Export failed", e);
                        alert("Export failed. See console for details.");
                      } finally {
                        console.groupEnd();
                      }
                    }}
                  >
                    Export All
                  </Button>
                </div>

                {/* A/B Controls */}
                <div className="border-4 border-black bg-muted p-4 shadow-brutal mb-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                    <div>
                      <span className="font-bold">A:</span> {pickA !== null ? `#${pickA + 1}` : 'None'}
                    </div>
                    <div>
                      <span className="font-bold">B:</span> {pickB !== null ? `#${pickB + 1}` : 'None'}
                    </div>
                    <Button
                      variant="outline"
                      disabled={pickA === null || pickB === null || pickA === pickB}
                      onClick={async () => {
                        if (pickA === null || pickB === null || pickA === pickB) return;
                        try {
                          console.groupCollapsed('[EmailSubjectTool] Create A/B');
                          const a = results[pickA].text;
                          const b = results[pickB].text;
                          const { test } = await createAbTest({
                            tool_name: 'email_subject',
                            variant_a: a,
                            variant_b: b,
                            input_summary: `${formData.topic} | ${formData.audience} | ${formData.goal}`,
                          });
                          setAbTestId(String(test?.id || ''));
                        } catch (e) {
                          console.error('[EmailSubjectTool] Create A/B failed', e);
                          alert('Failed to create A/B test');
                        } finally {
                          console.groupEnd();
                        }
                      }}
                    >
                      Create A/B Test
                    </Button>
                    {abTestId && (
                      <>
                        <span className="ml-2">Test created</span>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              await setAbTestWinner(abTestId!, 'A');
                              alert('Marked A as winner');
                            } catch (e) { alert('Failed'); }
                          }}
                        >
                          Mark A winner
                        </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              await setAbTestWinner(abTestId!, 'B');
                              alert('Marked B as winner');
                            } catch (e) { alert('Failed'); }
                          }}
                        >
                          Mark B winner
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {results.map((result, index) => (
                    <div key={index} className="space-y-2">
                      <ResultCard
                        content={result.text}
                        index={index + 1}
                        metadata={{
                          label: "Open Rate",
                          value: result.openRate,
                          color: "text-accent"
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2 ml-12">
                        <div className="border-2 border-black bg-background px-2 py-1 text-xs font-bold uppercase">
                          Chars: {result.charCount}
                        </div>
                        <div className="border-2 border-black bg-background px-2 py-1 text-xs font-bold uppercase">
                          {result.charCount <= 41 ? "Mobile sweet spot" : result.charCount <= 70 ? "Desktop-friendly" : "Long"}
                        </div>
                        <Button variant="outline" onClick={() => setPickA(index)}>
                          {pickA === index ? 'Picked A' : 'Set A'}
                        </Button>
                        <Button variant="outline" onClick={() => setPickB(index)}>
                          {pickB === index ? 'Picked B' : 'Set B'}
                        </Button>
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
                  Fill in the form and click generate to see your results
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default EmailSubjectTool;
