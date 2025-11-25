import { getSupabaseAdmin } from '../../_lib/supabase';
import { getGemini } from '../../_lib/gemini';
import { searchKnowledge } from '../../_lib/knowledge';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { agentId, message, sessionId, attachments } = req.body;

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!agentId || (!message && (!attachments || attachments.length === 0))) {
        return res.status(400).json({ error: 'Missing agentId or content' });
    }

    try {
        const result = await chatWithAgent(userId, orgId, agentId, message || '', sessionId, attachments || []);
        res.json(result);
    } catch (e: any) {
        console.error("Agent Chat Error", e);
        res.status(500).json({ error: e.message });
    }
}

async function chatWithAgent(userId: string, orgId: string, agentId: string, userMessage: string, sessionId: string | null, attachments: any[]) {
    const supabaseAdmin = getSupabaseAdmin();
    const genAI = getGemini();
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
        attachments: attachments
    });

    // 4. RAG: Search Knowledge Base
    let contextText = "";
    try {
        const fileIds = agent.knowledge_file_ids;
        if (fileIds && fileIds.length === 0) {
             // No context
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

    // 5. Fetch History
    const { data: history } = await supabaseAdmin
        .from('agent_messages')
        .select('role, content, attachments')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true })
        .limit(10);

    // 6. Build Prompt
    const systemInstructionText = `You are an AI agent named "${agent.name}".
    
    Instructions:
    ${agent.instructions}
    
    ${contextText ? "Use the provided context to answer the user's question accurately. If the answer is not in the context, you can use your general knowledge but prioritize the context." : ""}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: 'v1' });
    
    // Construct chat history
    const chatHistory = (history || []).map((msg: any) => {
        const parts: any[] = [{ text: msg.content }];
        if (msg.attachments && Array.isArray(msg.attachments)) {
             msg.attachments.forEach((att: any) => {
                 if (att.content && att.type) {
                     parts.push({
                         inlineData: {
                             mimeType: att.type,
                             data: att.content.split(',')[1] || att.content
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

    let previousHistory = chatHistory.slice(0, -1);
    previousHistory = [
        { role: 'user', parts: [{ text: systemInstructionText }] },
        { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
        ...previousHistory
    ];
    
    const chatSession = model.startChat({ history: previousHistory });

    const currentParts: any[] = [{ text: userMessage + contextText }];
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
