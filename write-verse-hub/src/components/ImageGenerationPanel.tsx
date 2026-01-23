import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Image as ImageIcon, 
  Loader2, 
  Download, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { BlogSectionData } from './BlogSection';

// Available image generation models (matching OpenRouter IDs)
const IMAGE_MODELS = [
  { id: 'gemini-flash-image', name: 'Gemini 2.5 Flash', provider: 'Google', quality: 'Highest' },
  { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro', provider: 'Google', quality: 'Highest' },
  { id: 'flux-2-pro', name: 'FLUX.2 Pro', provider: 'Black Forest Labs', quality: 'High' },
];

interface ImageGenerationPanelProps {
  sections: BlogSectionData[];
  articleTitle?: string;
}

export function ImageGenerationPanel({ sections, articleTitle }: ImageGenerationPanelProps) {
  const [selectedBlog, setSelectedBlog] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [promptMode, setPromptMode] = useState<'section' | 'custom'>('section');

  // Build prompt from section context
  const buildPromptFromSection = () => {
    if (!selectedSection) return '';
    const section = sections.find(s => s.id === selectedSection);
    if (!section) return '';
    
    return `Create a professional, high-quality blog illustration for a section titled "${section.heading}". Context: ${section.content.substring(0, 200)}...`;
  };

  const handleGenerate = async () => {
    let prompt = promptMode === 'custom' ? customPrompt : buildPromptFromSection();
    
    if (!prompt.trim()) {
      toast.error('Please enter a prompt or select a section');
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
          sectionHeading: promptMode === 'section' ? sections.find(s => s.id === selectedSection)?.heading : undefined,
          style: 'professional blog illustration, high quality, detailed'
        })
      });

      const data = await res.json();
      
      if (data.success && (data.imageUrl || data.imageBase64)) {
        const imageUrl = data.imageUrl || `data:image/png;base64,${data.imageBase64}`;
        setGeneratedImage(imageUrl);
        toast.success('Image generated successfully!');
      } else {
        throw new Error(data.error || 'Failed to generate image');
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      toast.error(err.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'png' | 'jpg') => {
    if (!generatedImage) return;

    try {
      // For base64 or URL images
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      
      // Convert to desired format
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = generatedImage;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `generated-image.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(`Downloaded as ${format.toUpperCase()}`);
        }
      }, format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    } catch (err) {
      // Fallback: direct download
      const a = document.createElement('a');
      a.href = generatedImage;
      a.download = `generated-image.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    }
  };

  return (
    <Card className="border-4 border-black">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          AI Image Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={promptMode === 'section' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPromptMode('section')}
            className={promptMode === 'section' ? 'bg-black' : ''}
          >
            From Section
          </Button>
          <Button
            variant={promptMode === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPromptMode('custom')}
            className={promptMode === 'custom' ? 'bg-black' : ''}
          >
            Custom Prompt
          </Button>
        </div>

        {promptMode === 'section' ? (
          <>
            {/* Section Selection */}
            {sections.length > 0 ? (
              <div>
                <Label>Select Section</Label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border-2 border-black rounded-md"
                >
                  <option value="">Choose a section...</option>
                  {sections.map((section, idx) => (
                    <option key={section.id} value={section.id}>
                      {idx + 1}. {section.heading}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>Generate a blog first to select sections</p>
              </div>
            )}
          </>
        ) : (
          <div>
            <Label>Custom Prompt</Label>
            <Textarea
              placeholder="Describe the image you want to generate..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="mt-1 border-2 border-black min-h-[100px]"
            />
          </div>
        )}

        {/* Model Selection */}
        <div>
          <Label>AI Model</Label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full mt-1 px-3 py-2 border-2 border-black rounded-md"
          >
            {IMAGE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider}) - {model.quality}
              </option>
            ))}
          </select>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || (promptMode === 'section' && !selectedSection) || (promptMode === 'custom' && !customPrompt.trim())}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Generate Image</>
          )}
        </Button>

        {/* Generated Image Preview */}
        {generatedImage && (
          <div className="space-y-3">
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
        )}
      </CardContent>
    </Card>
  );
}
