import { getSupabaseAdmin } from './supabase.js';
import { searchKnowledge } from './knowledge.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

async function callOpenRouter(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://writerai.app',
            'X-Title': 'WriterAI Agent Helper',
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

export async function chatWithAgent(userId: string, orgId: string, agentId: string, userMessage: string, sessionId: string | null = null, attachments: any[] = []) {
    const supabaseAdmin = getSupabaseAdmin();
    
    if (!supabaseAdmin) throw new Error('Server misconfigured');

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
        const fileIds = agent.knowledge_file_ids;
        
        if (fileIds && fileIds.length === 0) {
             // Explicitly empty means no knowledge access
        } else {
            const docs = await searchKnowledge(orgId, userMessage, fileIds);
            if (docs && docs.length > 0) {
                contextText = "\n\nHere is relevant context from the knowledge base:\n" + 
                    docs.map((d: any) => `- ${d.content}`).join('\n\n');
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

    // Build OpenRouter-compatible messages
    const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemInstructionText }
    ];

    // Exclude the last message (the one we just inserted above)
    const historyWithoutLast = (history || []).slice(0, -1);
    historyWithoutLast.forEach((msg: any) => {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: String(msg.content ?? ''),
        });
    });

    // Attachments are currently ignored for OpenRouter calls in this helper.
    // (Workflow steps currently send plain text messages.)
    messages.push({
        role: 'user',
        content: userMessage + contextText,
    });

    console.log('[Agent Helper] Using OpenRouter with model:', OPENROUTER_MODEL);
    const responseText = await callOpenRouter(messages);

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
