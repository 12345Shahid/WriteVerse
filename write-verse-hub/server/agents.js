import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { searchKnowledge } from './knowledge-base.js';

// Init clients
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function chatWithAgent(userId, orgId, agentId, userMessage, sessionId = null, attachments = []) {
    if (!supabaseAdmin || !genAI) throw new Error('Server misconfigured');

    // 1. Validate Agent & Org
    const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('organization_id', orgId)
        .single();
    
    if (agentError || !agent) throw new Error('Agent not found');

    // 2. Manage Session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
        const { data: sess, error: sessError } = await supabaseAdmin
            .from('agent_sessions')
            .insert({ agent_id: agentId, user_id: userId, title: userMessage.slice(0, 50) })
            .select('id')
            .single();
        if (sessError) throw sessError;
        currentSessionId = sess.id;
    }

    // 3. Save User Message
    await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'user',
        content: userMessage,
        attachments: attachments // Save attachments metadata/content to DB
    });

    // 4. RAG: Search Knowledge Base
    let contextText = "";
    try {
        // Use agent-specific files if defined, otherwise search global org knowledge?
        // Requirement says: "Every agent will have the knowledge bases only associated with that agent"
        // So we should strictly filter by agent.knowledge_file_ids.
        // If the array is empty/null, does it mean "No Knowledge" or "All Knowledge"?
        // Based on "only associated", it likely means "No Knowledge" or explicit selection.
        // However, for backward compatibility, if null, maybe we search all? 
        // Let's assume strictly selected files. If array is empty, we search nothing?
        // Or if array is null, maybe search all (legacy behavior).
        
        const fileIds = agent.knowledge_file_ids;
        
        // If fileIds is not null/empty, we filter. 
        // If it's null/undefined, we might fallback to all (legacy) OR prefer empty.
        // Let's pass it to searchKnowledge, which handles null as "no filter" (search all).
        // But if the user wants to restrict to specific files, they will select them.
        // If they select NONE, the array is empty [], so filter_file_ids = [].
        // Our SQL "OR file_id = ANY(filter_file_ids)" with empty array results in FALSE for that condition?
        // Wait: "filter_file_ids IS NULL" handles the "All" case.
        // If we pass [], it is NOT NULL, so it will try to match ANY([]), which is false.
        // So if the agent has explicit empty list, it gets no context. Correct.
        
        if (fileIds && fileIds.length === 0) {
             // Explicitly empty means no knowledge access? 
             // Or does the user expect "All" if nothing selected?
             // Usually "Select Knowledge Base" implies opt-in.
             // Let's skip search if empty array to save cost/time.
        } else {
            const docs = await searchKnowledge(orgId, userMessage, fileIds);
            if (docs && docs.length > 0) {
                contextText = "\n\nHere is relevant context from the knowledge base:\n" + 
                    docs.map(d => `- ${d.content}`).join('\n\n');
            }
        }
    } catch (e) {
        console.warn("RAG Search failed", e);
    }

    // 5. Fetch History (Last 10 messages)
    const { data: history } = await supabaseAdmin
        .from('agent_messages')
        .select('role, content, attachments')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true }) // Oldest first for context window
        .limit(10); // Limit context

    // 6. Build Prompt
    const systemInstructionText = `You are an AI agent named "${agent.name}".
    
    Instructions:
    ${agent.instructions}
    
    ${contextText ? "Use the provided context to answer the user's question accurately. If the answer is not in the context, you can use your general knowledge but prioritize the context." : ""}
    `;

    // Initialize model without systemInstruction to avoid API errors
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
    }, { apiVersion: 'v1' });
    
    // Construct chat history for Gemini
    const chatHistory = (history || []).map(msg => {
        const parts = [{ text: msg.content }];
        // If we had attachments in history, we ideally re-hydrate them.
        // But for MVP, storing base64 in DB is heavy. 
        // Assuming `attachments` in DB has `content` (base64).
        // If the history is long, this might be too much payload.
        // For now, we only send attachments for the CURRENT turn to avoid context limits/costs,
        // OR we assume the model remembers context from previous turns if we use startChat properly.
        // Actually, startChat DOES need history.
        // If we save base64 to DB, we can replay it.
        if (msg.attachments && Array.isArray(msg.attachments)) {
             msg.attachments.forEach(att => {
                 if (att.content && att.type) {
                     parts.push({
                         inlineData: {
                             mimeType: att.type,
                             data: att.content.split(',')[1] || att.content // Ensure just base64
                         }
                     });
                 }
             });
        }
        return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts
        };
    });

    // Better approach: History is "previous turns".
    let previousHistory = chatHistory.slice(0, -1); 
    
    // Prepend system instruction as a "fake" user message to ensure it's always respected
    previousHistory = [
        { role: 'user', parts: [{ text: systemInstructionText }] },
        { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
        ...previousHistory
    ];
    
    const chatSession = model.startChat({
        history: previousHistory
    });

    // Prepare current message parts
    const currentParts = [{ text: userMessage + contextText }];
    if (attachments && Array.isArray(attachments)) {
        attachments.forEach(att => {
             if (att.content && att.type) {
                 currentParts.push({
                     inlineData: {
                         mimeType: att.type,
                         data: att.content.split(',')[1] || att.content
                     }
                 });
             }
        });
    }

    const result = await chatSession.sendMessage(currentParts);
    const responseText = result.response.text();

    // 7. Save Assistant Response
    await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: responseText
    });

    return {
        sessionId: currentSessionId,
        response: responseText,
        sources: contextText ? "Knowledge Base" : null
    };
}
