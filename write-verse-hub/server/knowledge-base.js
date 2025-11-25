import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Init clients
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function generateEmbedding(text) {
    if (!genAI) throw new Error("Gemini not configured");
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" }, { apiVersion: 'v1' });
    const result = await model.embedContent(text);
    return result.embedding.values; 
}

export async function ingestDocument(orgId, title, text) {
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    
    // 1. Create File Record
    const { data: file, error: fileError } = await supabaseAdmin
        .from('knowledge_files')
        .insert({ organization_id: orgId, title })
        .select('id')
        .single();
    
    if (fileError) throw fileError;
    const fileId = file.id;

    // 2. Chunk text (simple split by paragraphs for MVP)
    // ideally use a proper chunker, but splitting by double newlines is a good start
    const rawChunks = text.split(/\n\s*\n/).filter(c => c.trim().length > 20);
    
    const records = [];
    
    for (const chunk of rawChunks) {
        // Limit chunk size
        if (chunk.length > 4000) {
             // simple sub-chunking if huge
             const subChunks = chunk.match(/.{1,2000}/g) || [chunk];
             for (const sub of subChunks) {
                 const vector = await generateEmbedding(sub);
                 records.push({
                     organization_id: orgId,
                     file_id: fileId, // Link to file
                     title: title,
                     content: sub,
                     embedding: vector
                 });
             }
        } else {
            const vector = await generateEmbedding(chunk);
            records.push({
                organization_id: orgId,
                file_id: fileId, // Link to file
                title: title,
                content: chunk,
                embedding: vector
            });
        }
    }
    
    if (records.length === 0) return { chunks: 0 };

    // 3. Insert
    const { error } = await supabaseAdmin.from('knowledge_docs').insert(records);
    if (error) throw error;
    
    return { chunks: records.length, fileId };
}

export async function searchKnowledge(orgId, query, filterFileIds = null) {
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    
    const queryVector = await generateEmbedding(query);
    
    const { data, error } = await supabaseAdmin.rpc('match_documents_with_filters', {
        query_embedding: queryVector,
        match_threshold: 0.4, // Slightly lower threshold to ensure results
        match_count: 5,
        filter_org_id: orgId,
        filter_file_ids: filterFileIds
    });
    
    if (error) {
        // Fallback to old RPC if new one fails (migration safety)
        console.warn("New RPC failed, falling back...", error);
        return searchKnowledgeLegacy(orgId, query);
    }
    return data;
}

async function searchKnowledgeLegacy(orgId, query) {
    const queryVector = await generateEmbedding(query);
    const { data, error } = await supabaseAdmin.rpc('match_documents', {
        query_embedding: queryVector,
        match_threshold: 0.4,
        match_count: 5,
        filter_org_id: orgId
    });
    if (error) throw error;
    return data;
}
