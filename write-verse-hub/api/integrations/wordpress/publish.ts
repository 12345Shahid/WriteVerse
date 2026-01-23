import { VercelRequest, VercelResponse } from '@vercel/node';

// WordPress publish endpoint - ACTIVATED
const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!NANGO_SECRET_KEY) {
    console.error('[API][wordpress/publish] Nango secret key not configured');
    return res.status(500).json({ error: 'WordPress integration not configured. Please contact support.' });
  }

  const { Nango } = await import('@nangohq/node');
  const nango = new Nango({ secretKey: NANGO_SECRET_KEY });
  const userId = req.headers['x-user-id'] as string || 'anonymous';
  
  const { 
    title, 
    content, 
    slug, 
    metaDescription,
    status = 'draft', // Default to draft for safety
    categories = [],
    tags = [],
    featuredImage
  } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  console.log('[API][wordpress/publish] Publishing request:', { 
    userId, 
    title: title.substring(0, 50), 
    status, 
    contentLength: content?.length 
  });

  try {
    // Get WordPress connection from Nango
    const connection = await nango.getConnection('wordpress', userId);
    
    if (!connection) {
      return res.status(401).json({ 
        error: 'WordPress not connected',
        needsAuth: true
      });
    }

    const credentials = connection.credentials as any;
    const accessToken = credentials?.access_token;
    const siteUrl = (connection as any).connection_config?.site_url;

    if (!accessToken || !siteUrl) {
      return res.status(401).json({ 
        error: 'Invalid WordPress connection. Please reconnect.',
        needsAuth: true
      });
    }

    const wpApiUrl = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;

    const postData: any = {
      title: title,
      content: content,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
      status: status, // 'draft' or 'publish'
      excerpt: metaDescription || '',
      format: 'standard'
    };

    if (categories.length > 0) {
      postData.categories = categories;
    }

    if (tags.length > 0) {
      postData.tags = tags;
    }

    console.log('[API][wordpress/publish] Sending to WordPress:', { wpApiUrl, status: postData.status });

    const wpRes = await fetch(wpApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (!wpRes.ok) {
      const errorText = await wpRes.text();
      console.error('[API][wordpress/publish] WordPress API error:', errorText);
      throw new Error(`WordPress API error: ${wpRes.status}`);
    }

    const wpPost = await wpRes.json();

    console.log('[API][wordpress/publish] Success:', { postId: wpPost.id, link: wpPost.link });

    return res.json({
      success: true,
      post: {
        id: wpPost.id,
        title: wpPost.title?.rendered || title,
        slug: wpPost.slug,
        link: wpPost.link,
        status: wpPost.status,
        publishedAt: wpPost.date
      }
    });
  } catch (err: any) {
    console.error('[API][wordpress/publish] Error:', err);
    
    if (err.message?.includes('connection')) {
      return res.status(401).json({ 
        error: 'WordPress not connected or session expired',
        needsAuth: true
      });
    }
    
    return res.status(500).json({ error: err.message });
  }
}
