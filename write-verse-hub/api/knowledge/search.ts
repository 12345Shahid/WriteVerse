import { searchKnowledge } from '../_lib/knowledge.js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    
    const orgId = req.headers['x-organization-id'];
    const { query, fileIds } = req.body;

    if (!orgId || !query) {
        return res.status(400).json({ error: 'Missing orgId or query' });
    }

    try {
        const results = await searchKnowledge(orgId, query, fileIds || null);
        res.json({ results });
    } catch (e: any) {
        console.error("Search Error", e);
        res.status(500).json({ error: e.message });
    }
}
