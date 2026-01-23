import { useState, useEffect } from 'react';
import { SiteNav } from '@/components/SiteNav';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Image as ImageIcon, 
  Loader2, 
  Download, 
  RefreshCw,
  Sparkles,
  Wand2,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';

// Available image generation models (matching OpenRouter IDs)
const IMAGE_MODELS = [
  { id: 'gemini-flash-image', name: 'Gemini 2.5 Flash', provider: 'Google', quality: 'Highest', desc: 'Fastest, most reliable (~10s)' },
  { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro', provider: 'Google', quality: 'Highest', desc: 'Latest Gemini model (~15s)' },
  { id: 'flux-2-pro', name: 'FLUX.2 Pro', provider: 'Black Forest Labs', quality: 'High', desc: 'High quality (~20-30s)' },
];

export default function ImageGenerator() {
  const { canGenerate, isViewer } = usePermissions();
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generationHistory, setGenerationHistory] = useState<{prompt: string, imageUrl: string, model: string}[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async (uid: string) => {
      if (!mounted) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generations/list?type=image&limit=10`, {
          headers: {
            'X-User-Id': uid
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.generations && mounted) {
            setGenerationHistory(data.generations.map((g: any) => ({
              prompt: g.prompt || g.title || '',
              imageUrl: g.image_url || '',
              model: g.model || 'unknown'
            })));
          }
        }
      } catch (err) {
        console.warn('[ImageGenerator] Failed to load history:', err);
      }
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) loadHistory(session.user.id);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user.id) {
        loadHistory(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error('Viewers cannot generate images');
      return;
    }
    
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({
          prompt: prompt,
          model: selectedModel,
          style: 'high quality, detailed, professional'
        })
      });

      const data = await res.json();
      
      if (data.success && (data.imageUrl || data.imageBase64)) {
        const imageUrl = data.imageUrl || `data:image/png;base64,${data.imageBase64}`;
        setGeneratedImage(imageUrl);
        
        // Add to local history
        setGenerationHistory(prev => [{
          prompt: prompt,
          imageUrl: imageUrl,
          model: selectedModel
        }, ...prev.slice(0, 9)]);
        
        // Save to database for persistence
        try {
          await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generations/save`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': session?.user.id || ''
            },
            body: JSON.stringify({
              type: 'image',
              title: prompt.substring(0, 100),
              imageUrl: imageUrl,
              prompt: prompt,
              model: selectedModel,
              metadata: {}
            })
          });
        } catch (saveErr) {
          console.warn('[Image] Failed to save to history:', saveErr);
        }
        
        toast.success('Image generated successfully!');
      } else {
        throw new Error(data.message || data.error || 'Failed to generate image');
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      toast.error(err.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'png' | 'jpg', imageUrl?: string) => {
    const url = imageUrl || generatedImage;
    if (!url) return;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `ai-image-${Date.now()}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          toast.success(`Downloaded as ${format.toUpperCase()}`);
        }
      }, format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    } catch (err) {
      // Fallback
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-image-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <SiteNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              AI Image Generator
            </h1>
            <p className="text-gray-600">
              Create stunning images with multiple AI models
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Generation Panel */}
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Generate Image
                </CardTitle>
                <CardDescription>
                  Describe what you want to create
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prompt Input */}
                <div>
                  <Label>Your Prompt</Label>
                  <Textarea
                    placeholder="A futuristic city at sunset with flying cars and neon lights..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="mt-1 border-2 border-black min-h-[120px]"
                  />
                  <div className="mt-2 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Pro Tip:</strong> Be descriptive! Instead of "cat", try "A fluffy orange cat lounging on a velvet cushion in a sunlit Victorian library". The more detail, the better your results! 🎨
                      </span>
                    </p>
                  </div>
                </div>

                {/* Model Selection */}
                <div>
                  <Label>AI Model</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {IMAGE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          selectedModel === model.id 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{model.name}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            model.quality === 'Highest' ? 'bg-green-100 text-green-700' :
                            model.quality === 'High' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {model.quality}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{model.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Viewer Restriction Warning */}
                {isViewer && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-lg flex items-start gap-3">
                    <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-yellow-900">Viewer Role Restriction</p>
                      <p className="text-sm text-yellow-700">You need editor or admin role to generate images. Contact your workspace admin for access.</p>
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || isViewer}
                  className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg ${
                    isViewer ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={isViewer ? 'Viewers cannot generate images' : ''}
                >
                  {isGenerating ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Generate Image</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview Panel */}
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedImage ? (
                  <div className="space-y-4">
                    <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={generatedImage} 
                        alt="Generated" 
                        className="w-full h-auto"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('png')}
                        className="flex-1"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        PNG
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('jpg')}
                        className="flex-1"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        JPG
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <div className="text-center text-gray-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Your generated image will appear here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Generation History */}
          {generationHistory.length > 0 && (
            <Card className="border-4 border-black mt-6">
              <CardHeader>
                <CardTitle>Recent Generations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {generationHistory.map((item, idx) => (
                    <div key={idx} className="group relative">
                      <img 
                        src={item.imageUrl} 
                        alt={item.prompt}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 bg-white"
                            onClick={() => handleDownload('png', item.imageUrl)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
