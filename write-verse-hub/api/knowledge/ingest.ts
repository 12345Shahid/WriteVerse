import { ingestDocument } from '../../_lib/knowledge';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const orgId = req.headers['x-organization-id'];
  const { title, text } = req.body;

  if (!orgId || !title || !text) {
      return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const result = await ingestDocument(orgId, title, text);
    res.json(result);
  } catch (e: any) {
    if (e.code === '23505') {
        return res.status(409).json({ error: 'A file with this title already exists.' });
    }
    console.error("Ingest Error", e);
    res.status(500).json({ error: e.message });
  }
}
