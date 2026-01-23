import { useState } from 'react';
import { SiteNav } from '@/components/SiteNav';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Sparkles, Loader2, CheckCircle2, AlertTriangle, 
  XCircle, Copy, RefreshCw, Shield, PenTool, Plus, X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface DetectionResult {
  humanScore: number;
  aiScore: number;
  verdict: string;
  breakdown: {
    burstiness: number;
    vocabulary: number;
    patterns: number;
    llmAnalysis: number;
  };
  reasoning: string;
}

interface HumanizeResult {
  original: string;
  humanized: string;
  style: string;
  wordCountOriginal: number;
  wordCountHumanized: number;
}

const STYLES = [
  { id: 'standard', name: 'Standard', desc: 'Natural, conversational' },
  { id: 'academic', name: 'Academic', desc: 'Scholarly, formal' },
  { id: 'simple', name: 'Simple', desc: 'Easy to understand' },
  { id: 'formal', name: 'Formal', desc: 'Professional tone' },
  { id: 'creative', name: 'Creative', desc: 'Engaging, vivid' },
];

export default function AITools() {
  const [detectText, setDetectText] = useState('');
  const [humanizeText, setHumanizeText] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('standard');
  const [freezeWords, setFreezeWords] = useState<string[]>([]);
  const [newFreezeWord, setNewFreezeWord] = useState('');

  const handleDetect = async () => {
    if (!detectText.trim() || detectText.length < 50) {
      toast.error('Please enter at least 50 characters');
      return;
    }

    setDetecting(true);
    setDetectionResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai-tools/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({ text: detectText })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Detection failed');
      }

      const result = await res.json();
      setDetectionResult(result);
      toast.success('Analysis complete');
    } catch (err: any) {
      console.error('Detection error:', err);
      toast.error(err.message || 'Failed to analyze text');
    } finally {
      setDetecting(false);
    }
  };

  const handleHumanize = async () => {
    if (!humanizeText.trim() || humanizeText.length < 20) {
      toast.error('Please enter at least 20 characters');
      return;
    }

    setHumanizing(true);
    setHumanizeResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai-tools/humanize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({ 
          text: humanizeText,
          style: selectedStyle,
          freezeList: freezeWords
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Humanization failed');
      }

      const result = await res.json();
      setHumanizeResult(result);
      toast.success('Text humanized successfully');
    } catch (err: any) {
      console.error('Humanize error:', err);
      toast.error(err.message || 'Failed to humanize text');
    } finally {
      setHumanizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const addFreezeWord = () => {
    if (newFreezeWord.trim() && !freezeWords.includes(newFreezeWord.trim())) {
      setFreezeWords([...freezeWords, newFreezeWord.trim()]);
      setNewFreezeWord('');
    }
  };

  const removeFreezeWord = (word: string) => {
    setFreezeWords(freezeWords.filter(w => w !== word));
  };

  const getVerdictIcon = (verdict: string) => {
    if (verdict.includes('Human')) return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    if (verdict.includes('Mixed')) return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    return <XCircle className="w-6 h-6 text-red-500" />;
  };

  const getVerdictColor = (verdict: string) => {
    if (verdict.includes('Human')) return 'bg-green-100 border-green-500 text-green-800';
    if (verdict.includes('Mixed')) return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    return 'bg-red-100 border-red-500 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-black flex items-center justify-center gap-3">
              <Shield className="w-10 h-10" />
              AI Content Tools
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              Detect AI-generated content or humanize your writing
            </p>
          </div>

          <Tabs defaultValue="detect" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="detect" className="text-lg font-bold">
                <Search className="w-5 h-5 mr-2" />
                AI Detector
              </TabsTrigger>
              <TabsTrigger value="humanize" className="text-lg font-bold">
                <PenTool className="w-5 h-5 mr-2" />
                Humanizer
              </TabsTrigger>
            </TabsList>

            {/* AI Detector Tab */}
            <TabsContent value="detect">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input */}
                <Card className="border-4 border-black">
                  <CardHeader>
                    <CardTitle>Paste Your Text</CardTitle>
                    <CardDescription>Enter text to analyze for AI detection</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Paste your text here (minimum 50 characters)..."
                      value={detectText}
                      onChange={(e) => setDetectText(e.target.value)}
                      className="min-h-[300px] border-2 border-black"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {detectText.length} characters
                      </span>
                      <Button 
                        onClick={handleDetect}
                        disabled={detecting || detectText.length < 50}
                        className="bg-black text-white"
                      >
                        {detecting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                        ) : (
                          <><Search className="w-4 h-4 mr-2" /> Detect AI</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Results */}
                <Card className="border-4 border-black">
                  <CardHeader>
                    <CardTitle>Detection Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!detectionResult ? (
                      <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                        <Shield className="w-16 h-16 mb-4" />
                        <p>Results will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Verdict */}
                        <div className={`p-4 rounded-lg border-2 ${getVerdictColor(detectionResult.verdict)}`}>
                          <div className="flex items-center gap-3">
                            {getVerdictIcon(detectionResult.verdict)}
                            <div>
                              <p className="font-bold text-lg">{detectionResult.verdict}</p>
                              <p className="text-sm opacity-80">{detectionResult.reasoning}</p>
                            </div>
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                            <p className="text-sm text-green-600 font-medium">Human Score</p>
                            <p className="text-3xl font-black text-green-700">{detectionResult.humanScore}%</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                            <p className="text-sm text-red-600 font-medium">AI Score</p>
                            <p className="text-3xl font-black text-red-700">{detectionResult.aiScore}%</p>
                          </div>
                        </div>

                        {/* Breakdown */}
                        <div className="space-y-3">
                          <p className="font-bold text-sm uppercase text-gray-500">Analysis Breakdown</p>
                          {Object.entries(detectionResult.breakdown).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                              <span className="text-sm w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-3">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold w-12">{value}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Humanizer Tab */}
            <TabsContent value="humanize">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input */}
                <Card className="border-4 border-black">
                  <CardHeader>
                    <CardTitle>Text to Humanize</CardTitle>
                    <CardDescription>Paste AI-generated text to make it sound human</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Paste AI-generated text here..."
                      value={humanizeText}
                      onChange={(e) => setHumanizeText(e.target.value)}
                      className="min-h-[200px] border-2 border-black"
                    />

                    {/* Style Selection */}
                    <div className="space-y-2">
                      <Label className="font-bold">Output Style</Label>
                      <div className="flex flex-wrap gap-2">
                        {STYLES.map(style => (
                          <Button
                            key={style.id}
                            variant={selectedStyle === style.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedStyle(style.id)}
                            className={selectedStyle === style.id ? 'bg-black text-white' : ''}
                          >
                            {style.name}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        {STYLES.find(s => s.id === selectedStyle)?.desc}
                      </p>
                    </div>

                    {/* Freeze List */}
                    <div className="space-y-2">
                      <Label className="font-bold">Freeze List (words to keep unchanged)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add word..."
                          value={newFreezeWord}
                          onChange={(e) => setNewFreezeWord(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addFreezeWord()}
                          className="flex-1"
                        />
                        <Button variant="outline" onClick={addFreezeWord}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {freezeWords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {freezeWords.map((word, i) => (
                            <Badge key={i} variant="outline" className="flex items-center gap-1">
                              {word}
                              <button onClick={() => removeFreezeWord(word)} className="hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={handleHumanize}
                      disabled={humanizing || humanizeText.length < 20}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    >
                      {humanizing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Humanizing...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Humanize Text</>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Output */}
                <Card className="border-4 border-black">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Humanized Result</span>
                      {humanizeResult && (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => copyToClipboard(humanizeResult.humanized)}
                          >
                            <Copy className="w-4 h-4 mr-1" /> Copy
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setHumanizeText(humanizeResult.humanized);
                              setHumanizeResult(null);
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" /> Re-humanize
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!humanizeResult ? (
                      <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                        <PenTool className="w-16 h-16 mb-4" />
                        <p>Humanized text will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200 min-h-[200px]">
                          <p className="whitespace-pre-wrap">{humanizeResult.humanized}</p>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Original: {humanizeResult.wordCountOriginal} words</span>
                          <span>Humanized: {humanizeResult.wordCountHumanized} words</span>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          Style: {humanizeResult.style}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
