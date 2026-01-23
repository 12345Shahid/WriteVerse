/**
 * API v1 - List Available Tools
 * GET /api/v1/tools
 * 
 * Returns list of available content generation tools.
 * No authentication required (public endpoint).
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

const TOOLS = [
    // Short-form tools
    { name: 'email_subject', description: 'Generate email subject lines', category: 'email' },
    { name: 'cold_email', description: 'Write cold outreach emails', category: 'email' },
    { name: 'email_writer', description: 'General email writing', category: 'email' },
    { name: 'linkedin', description: 'LinkedIn post generator', category: 'social' },
    { name: 'twitter_thread', description: 'Twitter/X thread generator', category: 'social' },
    { name: 'social_ad', description: 'Social media ads', category: 'social' },
    { name: 'social_helper', description: 'General social media copy', category: 'social' },
    { name: 'product_description', description: 'E-commerce product descriptions', category: 'marketing' },
    { name: 'job_description', description: 'Job posting generator', category: 'hr' },
    { name: 'resume', description: 'Resume bullet points', category: 'hr' },
    { name: 'cover_letter', description: 'Cover letter generator', category: 'hr' },
    { name: 'summarizer', description: 'Text summarization', category: 'utility' },
    { name: 'rewrite_helper', description: 'Rewrite and improve text', category: 'utility' },
    { name: 'faq', description: 'FAQ generator', category: 'content' },
    { name: 'script', description: 'Video/podcast script', category: 'content' },
    
    // Long-form tools
    { name: 'blog_post', description: 'Full blog post generator', category: 'long-form' },
    { name: 'blog_helper', description: 'Blog writing assistant', category: 'long-form' },
    { name: 'article_from_outline', description: 'Article from outline', category: 'long-form' },
    { name: 'seo_blog_optimizer', description: 'SEO optimized blog content', category: 'long-form' },
    { name: 'case_study_writer', description: 'Case study generator', category: 'long-form' },
    { name: 'landing_page_writer', description: 'Landing page copy', category: 'long-form' },
    { name: 'report_writer', description: 'Report generator', category: 'long-form' },
    { name: 'copy_helper', description: 'Marketing copy assistant', category: 'marketing' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Use GET' });
    }

    // Group by category
    const byCategory = TOOLS.reduce((acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push({ name: tool.name, description: tool.description });
        return acc;
    }, {} as Record<string, { name: string, description: string }[]>);

    console.log('[API v1] Tools list requested');

    return res.status(200).json({
        tools: TOOLS,
        byCategory,
        total: TOOLS.length
    });
}
