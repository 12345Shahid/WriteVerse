import { useState } from "react";
import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generate, saveResults } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";

interface EmailResult { text: string }

const EmailWriterTool = () => {
  const [formData, setFormData] = useState({
    emailType: "professional",
    recipient: "",
    subject: "",
    context: "",
    tone: "professional",
    outputCount: 2,
  });
  const [results, setResults] = useState<EmailResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!formData.subject.trim() && !formData.context.trim()) {
      alert("Please enter at least a subject or some context");
      return;
    }

    setIsLoading(true);
    console.groupCollapsed("[EmailWriterTool] Generate");
    const inputs = {
      emailType: formData.emailType,
      recipient: formData.recipient,
      subject: formData.subject,
      context: formData.context,
      tone: formData.tone,
    };
    console.debug("inputs", inputs);

    try {
      const data = await generate({
        tool: "email_writer",
        inputs,
        outputCount: formData.outputCount,
      });
      const out = (data?.results ?? []) as EmailResult[];
      setResults(out);
      try {
        console.groupCollapsed("[EmailWriterTool] Save results");
        await saveResults({ tool_name: "email_writer", input_data: inputs, results: out });
      } catch (e) {
        console.error("[EmailWriterTool] Save failed", e);
      } finally {
        console.groupEnd();
      }
    } catch (err: any) {
      console.error("[EmailWriterTool] Generation failed", err);
      alert(err?.message || "Failed to generate email.");
    } finally {
      console.groupEnd();
      setIsLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Email Writer"
      description="Draft follow-ups, outreach, newsletters, and professional emails in seconds."
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="border-4 border-black bg-brutalist-yellow p-6 shadow-brutal-lg sticky top-24">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Email Inputs
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-sm">Email Type</Label>
                  <Select
                    value={formData.emailType}
                    onValueChange={(v) => setFormData({ ...formData, emailType: v })}
                  >
                    <SelectTrigger className="input-brutal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="follow_up">Follow-Up</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="thank_you">Thank You</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient" className="font-bold uppercase text-sm">
                    Recipient (optional)
                  </Label>
                  <Input
                    id="recipient"
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    className="input-brutal"
                    placeholder="e.g. Hiring Manager, Existing Customer, Lead from Twitter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="font-bold uppercase text-sm">
                    Subject / Topic
                  </Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="input-brutal"
                    placeholder="Subject line or one-line summary of the email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context" className="font-bold uppercase text-sm">
                    Context / Details
                  </Label>
                  <Textarea
                    id="context"
                    value={formData.context}
                    onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                    rows={5}
                    className="input-brutal resize-none"
                    placeholder="Paste notes about the situation, what you want to achieve, and any key points."
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
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
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
                    max={5}
                    value={formData.outputCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        outputCount: Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                      })
                    }
                    className="input-brutal w-24"
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || (!formData.subject.trim() && !formData.context.trim())}
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
                      Generate Emails
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
                <h3 className="text-2xl font-bold mb-2">Write Polished Emails on Autopilot</h3>
                <p className="text-lg font-medium text-muted-foreground">
                  Choose the email type, add a subject and context, and generate ready-to-send drafts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default EmailWriterTool;
