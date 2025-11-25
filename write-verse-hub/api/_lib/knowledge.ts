import { getGemini } from './gemini';
import { getSupabaseAdmin } from './supabase';

export async function generateEmbedding(text: string) {
    const genAI = getGemini();
    if (!genAI) throw new Error("Gemini not configured");
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" }, { apiVersion: 'v1' });
    const result = await model.embedContent(text);
    return result.embedding.values; 
}

export async function searchKnowledge(orgId: string, query: string, filterFileIds: string[] | null = null) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    
    const queryVector = await generateEmbedding(query);
    
    // Try new RPC first
    const { data, error } = await supabaseAdmin.rpc('match_documents_with_filters', {
        query_embedding: queryVector,
        match_threshold: 0.4,
        match_count: 5,
        filter_org_id: orgId,
        filter_file_ids: filterFileIds
    });
    
    if (error) {
        console.warn("New RPC failed, falling back...", error);
         // Fallback legacy
        const { data: legacyData, error: legacyError } = await supabaseAdmin.rpc('match_documents', {
            query_embedding: queryVector,
            match_threshold: 0.4,
            match_count: 5,
            filter_org_id: orgId
        });
        if (legacyError) throw legacyError;
        return legacyData;
    }
    return data;
}

export async function ingestDocument(orgId: string, title: string, text: string) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    
    // 1. Create File Record
    const { data: file, error: fileError } = await supabaseAdmin
        .from('knowledge_files')
        .insert({ organization_id: orgId, title })
        .select('id')
        .single();
    
    if (fileError) throw fileError;
    const fileId = file.id;

    // 2. Chunk text
    const rawChunks = text.split(/\n\s*\n/).filter(c => c.trim().length > 20);
    
    const records = [];
    
    for (const chunk of rawChunks) {
        if (chunk.length > 4000) {
             const subChunks = chunk.match(/.{1,2000}/g) || [chunk];
             for (const sub of subChunks) {
                 const vector = await generateEmbedding(sub);
                 records.push({
                     organization_id: orgId,
                     file_id: fileId,
                     title: title,
                     content: sub,
                     embedding: vector
                 });
             }
        } else {
            const vector = await generateEmbedding(chunk);
            records.push({
                organization_id: orgId,
                file_id: fileId,
                title: title,
                content: chunk,
                embedding: vector
            });
        }
    }
    
    if (records.length === 0) return { chunks: 0, fileId };

    // 3. Insert
    const { error } = await supabaseAdmin.from('knowledge_docs').insert(records);
    if (error) throw error;
    
    return { chunks: records.length, fileId };
}
