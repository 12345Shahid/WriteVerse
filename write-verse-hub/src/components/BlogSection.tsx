import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button-brutal';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  RefreshCw, Image as ImageIcon, Trash2, ChevronDown, ChevronUp, 
  Loader2, Sparkles, X, Pencil, Check, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export interface BlogSectionData {
  id: string;
  heading: string;
  content: string;
  image?: {
    url: string;
    prompt: string;
  };
}

interface BlogSectionProps {
  section: BlogSectionData;
  index: number;
  onUpdate: (id: string, updates: Partial<BlogSectionData>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRegenerateContent: (id: string, heading: string, content: string) => Promise<void>;
  isFirst: boolean;
  isLast: boolean;
  blogTopic: string;
}

export function BlogSection({
  section,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRegenerateContent,
  isFirst,
  isLast,
  blogTopic
}: BlogSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editHeading, setEditHeading] = useState(section.heading);
  const [editContent, setEditContent] = useState(section.content);
  const [imageError, setImageError] = useState(false);

  // Sync edit fields when section changes (important!)
  useEffect(() => {
    if (!isEditing) {
      setEditHeading(section.heading);
      setEditContent(section.content);
    }
  }, [section.heading, section.content, isEditing]);

  const handleStartEdit = () => {
    // Sync current values before entering edit mode
    setEditHeading(section.heading);
    setEditContent(section.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(section.id, { heading: editHeading, content: editContent });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditHeading(section.heading);
    setEditContent(section.content);
    setIsEditing(false);
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setImageError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({
          sectionHeading: section.heading,
          sectionContext: section.content.substring(0, 300),
          style: 'professional blog illustration'
        })
      });

      const data = await res.json();

      if (data.success && (data.imageUrl || data.imageBase64)) {
        onUpdate(section.id, {
          image: {
            url: data.imageUrl || `data:image/png;base64,${data.imageBase64}`,
            prompt: data.prompt
          }
        });
        toast.success('Image generated!');
      } else if (data.placeholder) {
        // Use placeholder - fix URL format
        const keyword = encodeURIComponent(section.heading.split(' ').slice(0, 3).join(' '));
        const placeholderUrl = `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop&q=80`;
        onUpdate(section.id, {
          image: {
            url: placeholderUrl,
            prompt: section.heading
          }
        });
        toast.success('Placeholder image added');
      } else {
        toast.error('Could not generate image');
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      toast.error(err.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRemoveImage = () => {
    onUpdate(section.id, { image: undefined });
    setImageError(false);
  };

  const handleRegenerate = async () => {
    // Check if both heading and content are empty/default
    const hasHeading = section.heading && section.heading !== 'New Section';
    const hasContent = section.content && !section.content.includes('Click to edit');
    
    if (!hasHeading && !hasContent) {
      toast.error('Please add a heading or content before regenerating');
      return;
    }
    
    setIsRegenerating(true);
    try {
      // Pass BOTH heading AND content to regeneration
      await onRegenerateContent(section.id, section.heading, section.content);
      toast.success('Section regenerated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Check if regenerate should be disabled
  const isRegenerateDisabled = isRegenerating || 
    (!section.heading || section.heading === 'New Section') && 
    (!section.content || section.content.includes('Click to edit'));

  return (
    <div className="border-2 border-black bg-white shadow-brutal mb-4">
      {/* Section Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500">Section {index + 1}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onMoveUp(section.id)}
              disabled={isFirst}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onMoveDown(section.id)}
              disabled={isLast}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit Button - Dedicated */}
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleStartEdit}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={handleRegenerate}
            disabled={isRegenerateDisabled}
            title={isRegenerateDisabled ? 'Add heading or content first' : 'Regenerate content'}
          >
            {isRegenerating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Regenerate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete(section.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Section Content */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <Input
              value={editHeading}
              onChange={(e) => setEditHeading(e.target.value)}
              className="font-bold text-lg"
              placeholder="Section heading..."
            />
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              className="resize-none"
              placeholder="Section content..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Check className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <XCircle className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded p-2 -m-2">
            <h3 className="text-xl font-bold mb-3">{section.heading}</h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {section.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate unique ID
export function generateSectionId(): string {
  return `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Parse HTML/content into sections
export function parseContentIntoSections(content: string, outline: string[] = []): BlogSectionData[] {
  const sections: BlogSectionData[] = [];
  
  // Try to split by H2 tags first (HTML content)
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const h2Matches = Array.from(content.matchAll(h2Regex));
  
  if (h2Matches.length > 0) {
    // Split content by H2 headers
    const parts = content.split(/<h2[^>]*>.*?<\/h2>/gi);
    
    for (let i = 0; i < h2Matches.length; i++) {
      const heading = h2Matches[i][1].replace(/<[^>]*>/g, '').trim();
      const sectionContent = parts[i + 1] || '';
      // Strip HTML and clean up
      const cleanContent = sectionContent
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .trim();
      
      if (heading) {
        sections.push({
          id: generateSectionId(),
          heading,
          content: cleanContent
        });
      }
    }
  } else if (outline.length > 0) {
    // Use outline to split content into sections
    // The outline contains section headings, try to find them in the content
    const lines = content.split('\n');
    let currentHeading = '';
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check if this line matches an outline heading
      const matchedHeading = outline.find(h => 
        trimmedLine === h || 
        trimmedLine.toLowerCase() === h.toLowerCase() ||
        trimmedLine.replace(/[^\w\s]/g, '') === h.replace(/[^\w\s]/g, '')
      );
      
      if (matchedHeading) {
        // Save previous section if exists
        if (currentHeading && currentContent.length > 0) {
          sections.push({
            id: generateSectionId(),
            heading: currentHeading,
            content: currentContent.join('\n').trim()
          });
        }
        currentHeading = matchedHeading;
        currentContent = [];
      } else if (currentHeading) {
        // Add to current section content
        currentContent.push(line);
      } else if (trimmedLine) {
        // Content before first heading - use as intro
        if (sections.length === 0 && !currentHeading) {
          currentHeading = outline[0] || 'Introduction';
          currentContent.push(line);
        }
      }
    }
    
    // Don't forget the last section
    if (currentHeading && currentContent.length > 0) {
      sections.push({
        id: generateSectionId(),
        heading: currentHeading,
        content: currentContent.join('\n').trim()
      });
    }
    
    // If no sections were created, create from outline with placeholder content
    if (sections.length === 0) {
      for (const heading of outline) {
        sections.push({
          id: generateSectionId(),
          heading,
          content: `This section covers: ${heading}. Click to edit and add your content.`
        });
      }
    }
  } else {
    // Try to split by lines that look like headings (short lines followed by content)
    const lines = content.split('\n');
    let currentHeading = 'Introduction';
    let currentContent: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim() || '';
      
      // A heading is typically: short (< 80 chars), no punctuation at end, followed by content
      const looksLikeHeading = line.length > 0 && 
                              line.length < 80 && 
                              !line.endsWith('.') && 
                              !line.endsWith(',') &&
                              !line.endsWith('?') &&
                              !line.endsWith('!') &&
                              (nextLine.length === 0 || nextLine.length > line.length);
      
      if (looksLikeHeading && currentContent.length > 2) {
        // Save previous section
        sections.push({
          id: generateSectionId(),
          heading: currentHeading,
          content: currentContent.join('\n').trim()
        });
        currentHeading = line;
        currentContent = [];
      } else if (line) {
        currentContent.push(line);
      }
    }
    
    // Add last section
    if (currentContent.length > 0) {
      sections.push({
        id: generateSectionId(),
        heading: currentHeading,
        content: currentContent.join('\n').trim()
      });
    }
  }
  
  // Ensure we have at least one section
  if (sections.length === 0) {
    sections.push({
      id: generateSectionId(),
      heading: 'Main Content',
      content: content.replace(/<[^>]*>/g, '').trim()
    });
  }
  
  return sections;
}
