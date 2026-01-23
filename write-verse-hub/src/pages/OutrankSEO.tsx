import { useState, useEffect } from 'react';
import { SiteNav } from '@/components/SiteNav';
import { Button } from '@/components/ui/button-brutal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Search, TrendingUp, FileText, Target, Loader2, ExternalLink, 
  BarChart2, Calendar, PenTool, Image, Globe, CheckCircle2, 
  Copy, Download, Send, Sparkles, Link2, X, Plus, RefreshCw, ImagePlus
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { BlogSection, BlogSectionData, parseContentIntoSections, generateSectionId } from '@/components/BlogSection';
import { usePermissions } from '@/hooks/usePermissions';
import { RestrictedFeature } from '@/components/RestrictedFeature';

interface KeywordResult {
  keyword: string;
  volume: number;
  difficulty: string;
  trend: string;
  cpc?: number;
}

interface SerpResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

interface GeneratedArticle {
  title: string;
  content: string;
  metaDescription: string;
  slug: string;
  images: string[];
}

export default function OutrankSEO() {
  const { canGenerate, isViewer } = usePermissions();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [serpLoading, setSerpLoading] = useState(false);
  const [blogLoading, setBlogLoading] = useState(false);
  const [keywords, setKeywords] = useState<KeywordResult[]>([]);
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  
  // Blog Writer State
  const [blogTopic, setBlogTopic] = useState('');
  const [blogLength, setBlogLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [includeImages, setIncludeImages] = useState(true);
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [blogHistory, setBlogHistory] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async (uid: string) => {
      if (!mounted) return;
      console.log('[OutrankSEO] Loading history for user:', uid);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generations/list?type=blog&limit=10`, {
          headers: {
            'X-User-Id': uid
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.generations && mounted) {
            setBlogHistory(data.generations);
          }
        }
      } catch (err) {
        console.warn('[OutrankSEO] Failed to load history:', err);
      }
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) loadHistory(session.user.id);
    });

    // Listen for auth changes to load history once ready
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user.id) {
        loadHistory(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [generatedArticle]);
  
  // WordPress State
  const [wpConnected, setWpConnected] = useState(false);
  const [wpSiteUrl, setWpSiteUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishMode, setPublishMode] = useState<'draft' | 'publish'>('draft');
  
  // Section-based editing (GravityWrite-like)
  const [sections, setSections] = useState<BlogSectionData[]>([]);
  const [articleOutline, setArticleOutline] = useState<string[]>([]);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  
  // Check WordPress connection on mount
  useEffect(() => {
    checkWordPressConnection();
  }, []);

  const handleKeywordResearch = async () => {
    if (!canGenerate) {
      toast.error('Viewers cannot generate content');
      return;
    }
    if (!keyword.trim()) {
      toast.error('Please enter a keyword');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({ keyword: keyword.trim() })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to fetch keywords');
      }

      const data = await res.json();
      setKeywords(data.keywords || []);
      setRelatedQuestions(data.relatedQuestions || []);
      // Auto-populate target keywords from search results if empty
      if (targetKeywords.length === 0 && data.keywords?.length > 0) {
        setTargetKeywords(data.keywords.slice(0, 5).map((k: any) => k.keyword));
      }
      toast.success(`Found ${data.keywords?.length || 0} keyword suggestions`);
    } catch (err: any) {
      console.error('Keyword research error:', err);
      toast.error(err.message || 'Failed to get keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleSerpAnalysis = async () => {
    if (!canGenerate) {
      toast.error('Viewers cannot generate content');
      return;
    }
    if (!keyword.trim()) {
      toast.error('Please enter a keyword');
      return;
    }

    setSerpLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/serp-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({ keyword: keyword.trim() })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to analyze SERP');
      }

      const data = await res.json();
      setSerpResults(data.results || []);
      toast.success(`Analyzed top ${data.results?.length || 0} results`);
    } catch (err: any) {
      console.error('SERP analysis error:', err);
      toast.error(err.message || 'Failed to analyze SERP');
    } finally {
      setSerpLoading(false);
    }
  };

  const handleGenerateBlog = async () => {
    if (!canGenerate) {
      toast.error('Viewers cannot generate content');
      return;
    }
    if (!blogTopic.trim()) {
      toast.error('Please enter a blog topic');
      return;
    }

    setBlogLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const wordCount = blogLength === 'short' ? 1000 : blogLength === 'medium' ? 2000 : 3500;
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({
          tool: 'blog_post',
          inputs: {
            topic: blogTopic,
            primaryKeyword: targetKeywords[0] || blogTopic,
            secondaryKeywords: targetKeywords.slice(1).join(', ') || keywords.slice(0, 5).map(k => k.keyword).join(', '),
            length: blogLength, // 'short', 'medium', or 'long'
            wordCount: wordCount, // Pass exact word count (1000, 2000, or 3500)
            audience: 'general readers',
            goal: 'educate and engage',
            outlineMode: 'auto',
            tone: 'professional',
            includeImages: includeImages
          }
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to generate article');
      }

      const data = await res.json();
      console.log('[Blog] API Response structure:', { 
        hasResults: !!data.results, 
        resultsType: typeof data.results,
        isArray: Array.isArray(data.results)
      });
      
      // Parse the generated content - API returns results directly (object, not array for blog_post)
      // results can be: object (blog_post), array (multi-output tools), or undefined
      const result = Array.isArray(data.results) ? data.results[0] : (data.results || data.result || data);
      console.log('[Blog] Parsed result keys:', Object.keys(result || {}));
      
      // Check for body in various possible field names
      let body = result.body || result.content || result.text || result.article || result.article_body || '';
      const title = result.title || result.optimized_title || blogTopic;
      const metaDesc = result.meta_description || result.optimized_meta_description || `Learn about ${blogTopic}`;
      const slug = result.slug_suggestion || blogTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      const outline = result.outline || [];
      
      console.log('[Blog] Content fields:', { 
        hasBody: !!body, 
        bodyLength: body?.length || 0,
        hasOutline: outline.length > 0,
        resultKeys: Object.keys(result)
      });
      
      // If body is empty but we have outline, generate content from outline headings
      if (!body && outline.length > 0) {
        console.warn('[Blog] Body is empty, constructing from outline');
        body = `${title}\n\n` + outline.map((h: string) => 
          `${h}\n\nThis section provides detailed information about ${h.toLowerCase()}. Further research and writing is recommended.`
        ).join('\n\n');
      }
      
      // If still no content, show error with guidance
      if (!body) {
        console.error('[Blog] No content generated. Raw result:', JSON.stringify(result).substring(0, 500));
        toast.error('No article content was generated. Try a more specific topic.');
        return;
      }
      
      
      // CRITICAL: Strip ALL HTML tags from body before any processing
      // This is our final line of defense against tag leakage
     const stripAllTags = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/<[^>]+>/g, '') // Remove all HTML tags
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>') // Unescape first
          .replace(/<[^>]+>/g, '') // Remove again after unescaping
          .replace(/\[|\]/g, '') // Remove array brackets
          .replace(/^\s*["']|["']\s*$/gm, '') //Remove quotes at line start/end
          .trim();
      };
      
      // Clean the body BEFORE any formatting
      body = stripAllTags(body);
      
      console.log('[Blog] Body after aggressive cleaning:', {
        length: body.length,
        hasTags: body.includes('<'),
        preview: body.substring(0, 200)
      });
      
      // Format content as HTML if it's plain text
      let formattedContent = body;
      if (body && !body.includes('<h1') && !body.includes('<p>')) {
        // Convert plain text to basic HTML with headings
        const lines = body.split('\n').filter((p: string) => p.trim());
        formattedContent = `<h1>${title}</h1>\n`;
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          // Check if line looks like a heading (from outline or short)
          if (outline.some((h: string) => trimmedLine.includes(h) || h.includes(trimmedLine)) || 
              (trimmedLine.length < 80 && trimmedLine.endsWith(':'))) {
            formattedContent += `<h2>${trimmedLine}</h2>\n`;
          } else {
            formattedContent += `<p>${trimmedLine}</p>\n`;
          }
        }
      }
      setGeneratedArticle({
        title: title,
        content: formattedContent,
        metaDescription: metaDesc,
        slug: slug,
        images: [] // Will be populated if images are generated
      });
      
      // Save to database for persistence
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generations/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': session?.user.id || ''
          },
          body: JSON.stringify({
            type: 'blog',
            title: title,
            content: formattedContent,
            metadata: { metaDescription: metaDesc, slug, wordCount }
          })
        });
      } catch (saveErr) {
        console.warn('[Blog] Failed to save to history:', saveErr);
      }
      
      // Parse content into sections for GravityWrite-like editing
      setArticleOutline(outline);
      const parsedSections = parseContentIntoSections(formattedContent, outline);
      setSections(parsedSections);
      
      toast.success('Article generated successfully!');
    } catch (err: any) {
      console.error('Blog generation error:', err);
      toast.error(err.message || 'Failed to generate article');
    } finally {
      setBlogLoading(false);
    }
  };
  
  // Section management functions
  const handleUpdateSection = (id: string, updates: Partial<BlogSectionData>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    // Also update the main article content
    updateArticleFromSections();
  };
  
  const handleDeleteSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    updateArticleFromSections();
  };
  
  const handleMoveSection = (id: string, direction: 'up' | 'down') => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      
      const newSections = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
      return newSections;
    });
  };
  
  const handleRegenerateSectionContent = async (id: string, heading: string, existingContent: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Build a better prompt that uses both heading and content context
    const contextInfo = existingContent && existingContent.length > 5 
      ? `Current content to improve/expand: ${existingContent.substring(0, 800)}`
      : '';
    
    // Use blog_helper tool which exists in the API
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': session?.user.id || ''
      },
      body: JSON.stringify({
        tool: 'blog_helper',
        inputs: {
          task: 'write section',
          topic: heading,
          context: contextInfo || `Topic: ${heading}`,
          audience: 'general readers who want detailed, practical information',
          goal: `Write a detailed, comprehensive blog section about "${heading}". 
The content should be:
- At least 200 words long
- Informative and engaging
- Well-structured with clear explanations
- Relevant and focused on the specific topic: "${heading}"
${contextInfo ? 'Use the existing content as reference but provide fresh, improved content.' : ''}`
        }
      })
    });
    
    if (!res.ok) throw new Error('Failed to regenerate section');
    
    const data = await res.json();
    const result = Array.isArray(data.results) ? data.results[0] : data.results;
    // Extract content from various possible response formats
    let newContent = result?.content || result?.body || result?.text || result?.output || '';
    
    // If result is a string directly
    if (typeof result === 'string') {
      newContent = result;
    }
    
    // Clean HTML tags
    newContent = newContent.replace(/<[^>]*>/g, '').trim();
    
    // Accept any non-empty content (removed length restriction)
    if (newContent && newContent.length > 0) {
      handleUpdateSection(id, { content: newContent, heading: heading });
    } else {
      throw new Error('No content was generated. Please try again.');
    }
  };
  
  const handleAddSection = () => {
    const newSection: BlogSectionData = {
      id: generateSectionId(),
      heading: 'New Section',
      content: 'Click to edit this section content.'
    };
    setSections(prev => [...prev, newSection]);
  };
  
  const handleExport = (format: 'html' | 'pdf') => {
    if (!generatedArticle || sections.length === 0) {
      toast.error('Generate an article first');
      return;
    }
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    if (format === 'html') {
      // Generate HTML
      let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${generatedArticle.title}</title>
  <meta name="description" content="${generatedArticle.metaDescription}">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin-top: 2rem; }
    p { line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${generatedArticle.title}</h1>
`;
      for (const section of sections) {
        htmlContent += `  <h2>${section.heading}</h2>\n`;
        htmlContent += `  <p>${section.content.replace(/\n/g, '</p>\n  <p>')}</p>\n`;
      }
      htmlContent += `</body>\n</html>`;
      
      content = htmlContent;
      filename = `${generatedArticle.slug || 'article'}.html`;
      mimeType = 'text/html';
    } else {
      // Generate PDF-ready HTML (opens print dialog)
      const pdfHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${generatedArticle.title}</title>
  <style>
    @page { margin: 1in; }
    body { font-family: Georgia, serif; max-width: 100%; margin: 0; padding: 0; font-size: 12pt; line-height: 1.6; }
    h1 { font-size: 24pt; margin-bottom: 12pt; text-align: center; }
    h2 { font-size: 16pt; margin-top: 18pt; margin-bottom: 8pt; }
    p { margin-bottom: 10pt; text-align: justify; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>${generatedArticle.title}</h1>
${sections.map(section => `  <h2>${section.heading}</h2>
  <p>${section.content.replace(/\n/g, '</p>\n  <p>')}</p>`).join('\n')}
</body>
</html>`;
      
      // Open in new window and trigger print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
        toast.success('Print dialog opened - Save as PDF');
        return;
      } else {
        toast.error('Popup blocked - Allow popups and try again');
        return;
      }
    }
    
    // Download the file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported as ${format.toUpperCase()}`);
  };
  
  const handleGenerateAllImages = async () => {
    if (sections.length === 0) {
      toast.error('Generate an article first');
      return;
    }
    
    setIsGeneratingAllImages(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
      for (const section of sections) {
        if (section.image) continue; // Skip if already has image
        
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
          handleUpdateSection(section.id, {
            image: {
              url: data.imageUrl || `data:image/png;base64,${data.imageBase64}`,
              prompt: data.prompt
            }
          });
        } else if (data.placeholder) {
          handleUpdateSection(section.id, {
            image: {
              url: data.placeholder,
              prompt: section.heading
            }
          });
        }
      }
      toast.success('Images generated for all sections!');
    } catch (err: any) {
      toast.error('Failed to generate some images');
    } finally {
      setIsGeneratingAllImages(false);
    }
  };
  
  // Rebuild article content from sections
  const updateArticleFromSections = () => {
    if (!generatedArticle || sections.length === 0) return;
    
    let newContent = `<h1>${generatedArticle.title}</h1>\n`;
    for (const section of sections) {
      newContent += `<h2>${section.heading}</h2>\n`;
      const paragraphs = section.content.split('\n').filter(p => p.trim());
      for (const p of paragraphs) {
        newContent += `<p>${p}</p>\n`;
      }
      if (section.image) {
        newContent += `<img src="${section.image.url}" alt="${section.heading}" />\n`;
      }
    }
    
    setGeneratedArticle(prev => prev ? { ...prev, content: newContent } : null);
  };

  const handleConnectWordPress = async () => {
    if (!wpSiteUrl.trim()) {
      toast.error('Please enter your WordPress site URL');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/integrations/wordpress/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({ siteUrl: wpSiteUrl.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect WordPress');
      }

      if (data.authUrl) {
        // Open OAuth flow in new window
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        toast.success('Complete the WordPress authentication in the popup window');
        // Poll for connection status
        setTimeout(() => checkWordPressConnection(), 5000);
      } else {
        setWpConnected(true);
        toast.success('WordPress connected!');
      }
    } catch (err: any) {
      console.error('WordPress connect error:', err);
      toast.error(err.message || 'Failed to connect WordPress');
    }
  };

  const checkWordPressConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/integrations/wordpress/connect`, {
        method: 'GET',
        headers: {
          'X-User-Id': session?.user.id || ''
        }
      });

      const data = await res.json();
      if (data.connected) {
        setWpConnected(true);
        if (data.siteUrl) setWpSiteUrl(data.siteUrl);
        toast.success('WordPress connected!');
      }
    } catch (err) {
      console.error('Check connection error:', err);
    }
  };

  const handlePublishToWordPress = async () => {
    if (!generatedArticle) {
      toast.error('Generate an article first');
      return;
    }

    if (!wpConnected) {
      toast.error('Connect your WordPress site first');
      return;
    }

    setPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/integrations/wordpress/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session?.user.id || ''
        },
        body: JSON.stringify({
          title: generatedArticle.title,
          content: generatedArticle.content,
          slug: generatedArticle.slug,
          metaDescription: generatedArticle.metaDescription,
          status: publishMode // Use state: 'draft' or 'publish'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsAuth) {
          setWpConnected(false);
          throw new Error('WordPress session expired. Please reconnect.');
        }
        throw new Error(data.error || 'Failed to publish');
      }

      toast.success('Article published to WordPress!');
      if (data.post?.link) {
        window.open(data.post.link, '_blank');
      }
    } catch (err: any) {
      console.error('WordPress publish error:', err);
      toast.error(err.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    // Strip HTML tags for plain text copy
    const plainText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    navigator.clipboard.writeText(plainText).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = plainText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Copied to clipboard!');
    });
  };

  const downloadAsHtml = () => {
    if (!generatedArticle) return;
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="description" content="${generatedArticle.metaDescription}">
  <title>${generatedArticle.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #1a1a1a; }
    p { line-height: 1.6; color: #333; }
  </style>
</head>
<body>
${generatedArticle.content}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedArticle.slug || 'article'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Article exported!');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteNav />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <PenTool className="w-8 h-8" />
              Blog Studio
            </h1>
            <p className="text-gray-600 mt-2">
              AI-powered SEO content creation: Research keywords, analyze competitors, write optimized articles, and publish directly.
            </p>
          </div>

          {/* Search Bar */}
          <Card className="border-4 border-black mb-6">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter a keyword or topic to research..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleKeywordResearch()}
                    className="text-lg py-6 border-2 border-black"
                  />
                </div>
                <Button 
                  onClick={handleKeywordResearch} 
                  disabled={loading || isViewer}
                  className={`bg-black text-white px-8 ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isViewer ? 'Viewers cannot generate content' : ''}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 mr-2" />}
                  Research
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleSerpAnalysis} 
                  disabled={serpLoading || isViewer}
                  className={`border-2 border-black ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isViewer ? 'Viewers cannot generate content' : ''}
                >
                  {serpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BarChart2 className="w-5 h-5 mr-2" />}
                  Analyze SERP
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Tabs */}
          <Tabs defaultValue="keywords" className="space-y-6">
            <TabsList className="border-2 border-black bg-white">
              <TabsTrigger value="keywords" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Keywords
              </TabsTrigger>
              <TabsTrigger value="serp" className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> SERP
              </TabsTrigger>
              <TabsTrigger value="questions" className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Questions
              </TabsTrigger>
              <TabsTrigger value="writer" className="flex items-center gap-2">
                <PenTool className="w-4 h-4" /> Blog Writer
              </TabsTrigger>
              <TabsTrigger value="wordpress" className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> WordPress
              </TabsTrigger>
              <TabsTrigger value="recent" className="flex items-center gap-2">
                <Image className="w-4 h-4" /> Recent Generations
              </TabsTrigger>
            </TabsList>

            {/* Keywords Tab */}
            <TabsContent value="keywords">
              {keywords.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-300">
                  <CardContent className="p-12 text-center text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Enter a keyword above to get suggestions and search volume data.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {keywords.map((kw, i) => (
                    <Card key={i} className="border-2 border-black hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-lg">{kw.keyword}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              <span>Volume: <strong>{kw.volume?.toLocaleString() || 'N/A'}</strong></span>
                              {kw.cpc && <span>CPC: <strong>${kw.cpc.toFixed(2)}</strong></span>}
                              <span>Trend: {kw.trend || 'stable'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getDifficultyColor(kw.difficulty)}>
                              {kw.difficulty || 'Unknown'}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={() => setBlogTopic(kw.keyword)}>
                              Write Article
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* SERP Tab */}
            <TabsContent value="serp">
              {serpResults.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-300">
                  <CardContent className="p-12 text-center text-gray-500">
                    <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Analyze SERP" to see competitor rankings for your keyword.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {serpResults.map((result, i) => (
                    <Card key={i} className="border-2 border-black">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                            {result.position}
                          </div>
                          <div className="flex-1">
                            <a 
                              href={result.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {result.title}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <p className="text-sm text-gray-600 mt-1">{result.snippet}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Questions Tab */}
            <TabsContent value="questions">
              {relatedQuestions.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-300">
                  <CardContent className="p-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Related questions will appear here after keyword research.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {relatedQuestions.map((q, i) => (
                    <Card key={i} className="border-2 border-black hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setBlogTopic(q)}>
                      <CardContent className="p-4">
                        <p className="font-medium">{q}</p>
                        <span className="text-sm text-blue-600 mt-2 block">
                          Click to write article →
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Blog Writer Tab */}
            <TabsContent value="writer">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Input */}
                <Card className="border-4 border-black">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PenTool className="w-5 h-5" />
                      SEO Blog Writer
                    </CardTitle>
                    <CardDescription>
                      Generate SEO-optimized articles with AI-powered images.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Blog Topic / Keyword</Label>
                      <Input
                        placeholder="e.g., How to start a successful blog in 2024"
                        value={blogTopic}
                        onChange={(e) => setBlogTopic(e.target.value)}
                        className="border-2 border-black mt-1"
                      />
                    </div>

                    <div>
                      <Label>Article Length</Label>
                      <div className="flex gap-2 mt-2">
                        {(['short', 'medium', 'long'] as const).map((len) => (
                          <Button
                            key={len}
                            variant={blogLength === len ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setBlogLength(len)}
                            className={blogLength === len ? 'bg-black text-white' : ''}
                          >
                            {len === 'short' ? '~1000' : len === 'medium' ? '~2000' : '~3500'} words
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        <Label>Include AI Images</Label>
                      </div>
                      <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                      <Label className="text-xs text-gray-500">Target Keywords (editable)</Label>
                      <div className="flex flex-wrap gap-1">
                        {targetKeywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs flex items-center gap-1">
                            {kw}
                            <button 
                              onClick={() => setTargetKeywords(prev => prev.filter((_, idx) => idx !== i))}
                              className="hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add keyword..."
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newKeyword.trim()) {
                              setTargetKeywords(prev => [...prev, newKeyword.trim()]);
                              setNewKeyword('');
                            }
                          }}
                          className="text-sm h-8"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (newKeyword.trim()) {
                              setTargetKeywords(prev => [...prev, newKeyword.trim()]);
                              setNewKeyword('');
                            }
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerateBlog}
                      disabled={blogLoading || !blogTopic || isViewer}
                      className={`w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isViewer ? 'Viewers cannot generate content' : ''}
                    >
                      {blogLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Generate SEO Article</>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Right: Section-based Editor */}
                <Card className="border-4 border-black">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Article Editor</span>
                      {generatedArticle && (
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedArticle.content)}>
                            <Copy className="w-4 h-4 mr-1" /> Copy
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {generatedArticle ? (
                      <div className="space-y-4">
                        {/* SEO Status */}
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-medium">SEO Optimized</span>
                            <span className="text-sm ml-auto">{sections.length} sections</span>
                          </div>
                        </div>
                        
                        {/* Article Meta */}
                        <div className="grid gap-3 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <Label className="text-xs text-gray-500">Title</Label>
                            <h2 className="text-xl font-bold">{generatedArticle.title}</h2>
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-500">Meta Description</Label>
                              <p className="text-sm text-gray-600">{generatedArticle.metaDescription}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Slug</Label>
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">/{generatedArticle.slug}</code>
                            </div>
                          </div>
                        </div>
                        
                        <hr />
                        
                        {/* Sections Editor */}
                        <div className="max-h-[400px] overflow-y-auto pr-2">
                          {sections.map((section, index) => (
                            <BlogSection
                              key={section.id}
                              section={section}
                              index={index}
                              onUpdate={handleUpdateSection}
                              onDelete={handleDeleteSection}
                              onMoveUp={(id) => handleMoveSection(id, 'up')}
                              onMoveDown={(id) => handleMoveSection(id, 'down')}
                              onRegenerateContent={handleRegenerateSectionContent}
                              isFirst={index === 0}
                              isLast={index === sections.length - 1}
                              blogTopic={blogTopic}
                            />
                          ))}
                        </div>
                        
                        {/* Add Section Button */}
                        <Button 
                          variant="outline" 
                          className="w-full border-dashed"
                          onClick={handleAddSection}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Add Section
                        </Button>
                        
                        <hr />
                        
                        {/* Export Section */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Download className="w-5 h-5 text-gray-600" />
                              <span className="font-medium">Export Article</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExport('html')}
                              className="flex-1"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Export HTML
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExport('pdf')}
                              className="flex-1"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Export PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <PenTool className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Your generated article will appear here.</p>
                        <p className="text-sm mt-2">Edit sections, add images, and publish to WordPress!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* WordPress Tab - Coming Soon */}
            <TabsContent value="wordpress">
              <div className="min-h-[300px] flex items-center justify-center">
                <div className="text-center p-8 max-w-md">
                  <Globe className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-2xl font-bold mb-2 text-gray-400">Coming Soon</h3>
                  <p className="text-gray-500">
                    WordPress integration is coming in a future update. 
                    For now, export your articles as HTML and upload manually.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Recent Generations Tab */}
            <TabsContent value="recent">
              <Card className="border-2 border-black">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Recent Blog Generations
                  </CardTitle>
                  <CardDescription>
                    View your recently generated blog articles. Click to load into the preview.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {blogHistory.length > 0 ? (
                      blogHistory.map((item, idx) => (
                        <div key={item.id || idx} className="p-4 border-2 border-black rounded-lg bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors group">
                          <div className="flex-1 min-w-0 mr-4">
                            <h4 className="font-bold truncate">{item.title}</h4>
                            <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 px-2 font-bold bg-blue-50 hover:bg-blue-100 border-blue-200"
                              onClick={() => {
                                setGeneratedArticle({
                                  title: item.title,
                                  content: item.content,
                                  metaDescription: item.metadata?.metaDescription || '',
                                  slug: item.metadata?.slug || '',
                                  images: []
                                });
                                // Also update outline if stored
                                if (Array.isArray(item.metadata?.outline)) {
                                  setArticleOutline(item.metadata.outline);
                                }
                                toast.success('Loaded into Studio for editing');
                              }}
                            >
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => {
                                const blob = new Blob([item.content], { type: 'text/html' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                toast.success('Downloaded HTML');
                              }}
                            >
                              <Download className="w-3 h-3 mr-1" /> HTML
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => {
                                // For PDF, we'll load it into state and then trigger handleExport or similar
                                setGeneratedArticle({
                                  title: item.title,
                                  content: item.content,
                                  metaDescription: item.metadata?.metaDescription || '',
                                  slug: item.metadata?.slug || '',
                                  images: []
                                });
                                // Slight delay to ensure state is updated
                                setTimeout(() => handleExport('pdf'), 100);
                              }}
                            >
                              <FileText className="w-3 h-3 mr-1" /> PDF
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="min-h-[200px] flex items-center justify-center">
                        <div className="text-center p-8 max-w-md">
                          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                          <h3 className="text-xl font-bold mb-2 text-gray-400">No blogs generated yet</h3>
                          <p className="text-gray-500 mb-4">
                            Generate a blog article using the Blog Writer tab to see it here.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

