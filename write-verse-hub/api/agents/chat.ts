import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { searchKnowledge } from '../_lib/knowledge.js';
import {
    buildParamsFromSchema,
    executeTool,
    findConnectionIdForApp,
    getRawToolsForApp,
    pickBestToolForQuery,
} from '../_lib/composio.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';
const AGENT_CHAT_FINGERPRINT = 'agent-chat-2025-12-14-1';
const AGENT_CHAT_BUILD =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.VERCEL_ENV ||
    'unknown';

console.log('[Agent Chat] Build fingerprint', AGENT_CHAT_BUILD);

function extractEmailCandidates(toolResult: any): any[] {
    const r = toolResult;
    const candidates: any[] = [];

    const pushAll = (arr: any) => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) candidates.push(item);
    };

    if (Array.isArray(r)) pushAll(r);
    pushAll(r?.messages);
    pushAll(r?.data?.messages);
    pushAll(r?.threads);
    pushAll(r?.data?.threads);
    pushAll(r?.items);
    pushAll(r?.data?.items);
    pushAll(r?.data?.threads?.items);
    pushAll(r?.data);
    pushAll(r?.results);
    pushAll(r?.emails);

    if (candidates.length > 0) return candidates;

    if (r?.message_id || r?.subject || r?.sender || r?.from) {
        return [r];
    }

    return [];
}

function formatEmailLine(m: any, idx: number) {
    const subject = String(m?.subject || m?.Subject || m?.payload?.headers?.find?.((h: any) => h?.name === 'Subject')?.value || '');
    const from = String(m?.sender || m?.from || m?.From || m?.payload?.headers?.find?.((h: any) => h?.name === 'From')?.value || '');
    const date = String(m?.message_timestamp || m?.internalDate || m?.date || m?.Date || '');
    const snippet = String(m?.snippet || m?.message_text || m?.body || '').slice(0, 200);
    const id = String(m?.message_id || m?.id || '');

    const bits = [
        `### ${idx + 1}`,
        subject ? `Subject: ${subject}` : null,
        from ? `From: ${from}` : null,
        date ? `Date: ${date}` : null,
        id ? `ID: ${id}` : null,
        snippet ? `Snippet: ${snippet}` : null,
    ].filter(Boolean);

    return bits.join('\n');
}

function buildDeterministicGmailReply(toolResult: any) {
    const emails = extractEmailCandidates(toolResult).slice(0, 5);
    if (emails.length === 0) {
        return 'I checked Gmail via your connected integration, but no recent emails were returned. Try again, or adjust the request (e.g., “unread emails from the last 7 days”).';
    }

    return [
        'Here are your most recent emails from Gmail:',
        '',
        ...emails.map((m, idx) => formatEmailLine(m, idx)),
    ].join('\n\n');
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        res.setHeader('x-agent-chat-build', String(AGENT_CHAT_BUILD));
        res.setHeader('x-agent-chat-fingerprint', String(AGENT_CHAT_FINGERPRINT));
    } catch {
        // ignore
    }

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { agentId, message, sessionId, attachments } = req.body;

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!agentId || (!message && (!attachments || attachments.length === 0))) {
        return res.status(400).json({ error: 'Missing agentId or content' });
    }

    console.log('[Agent Chat] Incoming request', {
        hasMessage: !!message,
        messagePreview: String(message || '').slice(0, 120),
        hasAttachments: Array.isArray(attachments) && attachments.length > 0,
    });

    try {
        const result = await chatWithAgent(userId, orgId, agentId, message || '', sessionId, attachments || []);
        res.json(result);
    } catch (e: any) {
        console.error("Agent Chat Error", e);
        res.status(500).json({ error: e.message });
    }
}

// Call OpenRouter API
async function callOpenRouter(messages: Array<{role: string, content: string}>): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://writerai.app',
            'X-Title': 'WriterAI Agent Chat',
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

function isEmailIntent(text: string) {
    const t = String(text || '').toLowerCase().trim();
    if (!t) return false;

    // If the user is trying to compose/send/reply, do NOT trigger the read/list inbox flow.
    // (Those capabilities require separate intent + safety/confirmation.)
    const composeKeywords = ['compose', 'write', 'draft', 'send', 'reply', 'respond', 'forward'];
    const isComposeLike = composeKeywords.some((k) => t.includes(k));

    // Intentionally broad, because the Gmail branch only performs read/list/search operations.
    const mailKeywords = [
        'gmail',
        'inbox',
        'email',
        'emails',
        'e-mail',
        'mailbox',
        'unread',
        'sender',
        'subject',
        'thread',
        'threads',
        'message',
        'messages',
    ];
    const actionKeywords = ['read', 'check', 'show', 'list', 'fetch', 'get', 'open', 'find', 'search', 'summarize'];
    const recencyKeywords = ['latest', 'recent', 'newest', 'last', 'today', 'yesterday'];
    // NOTE: exclude "draft" here because it commonly means "create a draft", not "read drafts".
    const folderKeywords = ['primary', 'promotions', 'social', 'spam', 'trash', 'sent', 'drafts', 'starred', 'important'];

    const hasMail = mailKeywords.some((k) => t.includes(k));
    const hasAction = actionKeywords.some((k) => t.includes(k));
    const hasRecency = recencyKeywords.some((k) => t.includes(k));
    const hasFolder = folderKeywords.some((k) => t.includes(k));

    // Explicit search syntax implies inbox search, even if the user is also composing.
    const hasSearchSyntax = t.includes('from:') || t.includes('subject:');
    // Explicit read/list signals.
    const hasReadSignal = hasAction || hasRecency || t.includes('inbox') || t.includes('unread');

    // If it looks like composing and there's no clear read/list/search signal, don't trigger Gmail read flow.
    if (isComposeLike && !hasSearchSyntax && !hasReadSignal) return false;

    // Common search patterns
    if (hasSearchSyntax) return true;

    // Most typical: user mentions email/gmail/inbox and asks to read/list/search
    if (hasMail && (hasAction || hasRecency || hasFolder)) return true;

    // Short prompts like "unread" / "inbox" / "latest" frequently mean email
    if (t === 'unread' || t === 'inbox' || t === 'gmail') return true;
    if ((t.includes('unread') || t.includes('inbox')) && hasAction) return true;

    // "Read my last 5" or similar, when it also references messages
    const hasCount = /\b\d+\b/.test(t);
    if (hasCount && hasRecency && (t.includes('email') || t.includes('emails') || t.includes('message') || t.includes('messages'))) {
        return true;
    }

    return false;
}

function isRetryIntent(text: string) {
    const t = String(text || '').toLowerCase().trim();
    if (!t) return false;

    const phrases = [
        'try again',
        'try it again',
        'retry',
        'do it again',
        'run it again',
        'please try again',
        'can you try again',
        'again',
    ];

    if (phrases.some((p) => t === p)) return true;
    if (t.includes('try') && t.includes('again')) return true;
    if (t.includes('retry')) return true;
    if (t.includes('again') && t.length <= 40) return true;
    return false;
}

function formatToolResultForPrompt(result: any) {
    try {
        if (result == null) return 'No result.';
        if (typeof result === 'string') return result;

        const json = JSON.stringify(result, null, 2);
        if (json.length <= 8000) return json;
        return json.slice(0, 8000) + '\n... (truncated)';
    } catch {
        return String(result);
    }
}

async function chatWithAgent(userId: string, orgId: string, agentId: string, userMessage: string, sessionId: string | null, attachments: any[]) {
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

    // Credits: check balance up-front (1 credit per agent message for now)
    const creditsCharged = 1;
    let orgCreditsBalance: number | null = null;
    try {
        const { data } = await supabaseAdmin
            .from('organization_credits')
            .select('balance_credits')
            .eq('organization_id', orgId)
            .maybeSingle();

        if (data && typeof data.balance_credits === 'number') {
            orgCreditsBalance = data.balance_credits;
            if (data.balance_credits < creditsCharged) {
                throw new Error('INSUFFICIENT_CREDITS');
            }
        }
    } catch (e: any) {
        if (String(e?.message || e) === 'INSUFFICIENT_CREDITS') {
            throw new Error('Not enough credits to chat with this agent');
        }
    }

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

    // 4b. Integrations: Gmail (Composio)
    let integrationsContextText = '';
    let directReply: string | null = null;
    let gmailToolPayload: any = null;

    const resolveGmailConnectionId = async () => {
        // 1) Try Composio lookup by userId (most common)
        const byUser = await findConnectionIdForApp(String(userId), 'gmail');
        if (byUser) return { connectionId: byUser, source: 'composio:userId' };

        // 2) Try DB link from agent_integrations (legacy/explicit linking)
        try {
            const { data: link } = await supabaseAdmin
                .from('agent_integrations')
                .select('connection_id, app_name')
                .eq('agent_id', agentId)
                .in('app_name', ['GMAIL', 'gmail'])
                .maybeSingle();

            const cid = String((link as any)?.connection_id || '').trim();
            if (cid) return { connectionId: cid, source: 'db:agent_integrations' };
        } catch (e: any) {
            console.warn('[Agent Chat] Gmail connection DB lookup failed', String(e?.message || e));
        }

        // 3) Try Composio lookup by orgId (some apps are connected per-org)
        const byOrg = await findConnectionIdForApp(String(orgId), 'gmail');
        if (byOrg) return { connectionId: byOrg, source: 'composio:orgId' };

        return { connectionId: null, source: null };
    };

    const retryIntent = isRetryIntent(userMessage);
    let effectiveUserMessage = userMessage;
    let previousWasEmailIntent = false;

    if (retryIntent) {
        try {
            // Fetch a few recent user messages and pick the last one that isn't the current retry text.
            const { data: recentUserMsgs } = await supabaseAdmin
                .from('agent_messages')
                .select('id, content, created_at')
                .eq('session_id', currentSessionId)
                .eq('role', 'user')
                .order('created_at', { ascending: false })
                .limit(10);

            const normalizedCurrent = String(userMessage || '').trim();
            const prev = (recentUserMsgs || []).find((m: any) => String(m?.content || '').trim() !== normalizedCurrent);
            if (prev?.content) {
                effectiveUserMessage = String(prev.content);
                // Only allow email intent fallback if the previous message was ALSO email-related
                previousWasEmailIntent = isEmailIntent(effectiveUserMessage);
            }
        } catch (e) {
            console.warn('[Agent Chat] Retry lookup failed', String((e as any)?.message || e));
        }
    }

    // Only trigger email flow if:
    // 1. Current message is email-related, OR
    // 2. It's a retry and the PREVIOUS message was email-related
    const emailIntent = retryIntent ? previousWasEmailIntent : isEmailIntent(effectiveUserMessage);
    console.log('[Agent Chat] emailIntent', {
        emailIntent,
        retryIntent,
        previousWasEmailIntent,
        userMessagePreview: String(userMessage || '').slice(0, 160),
        effectiveMessagePreview: String(effectiveUserMessage || '').slice(0, 160),
    });

    if (emailIntent) {
        try {
            console.log('[Agent Chat] Gmail connection resolve attempt', {
                userIdPreview: String(userId || '').slice(0, 8) + '...',
                orgIdPreview: String(orgId || '').slice(0, 8) + '...',
            });

            const resolved = await resolveGmailConnectionId();
            const gmailConnectionId = resolved.connectionId;
            console.log('[Agent Chat] Gmail connection lookup', {
                found: !!gmailConnectionId,
                connectionIdPreview: gmailConnectionId ? String(gmailConnectionId).slice(0, 12) + '...' : null,
                source: resolved.source,
            });
            if (!gmailConnectionId) {
                directReply = 'Gmail is not connected for your account yet. Please connect Gmail in Agent Integrations, then try again.';
            } else {
                const rawTools = await getRawToolsForApp('gmail');
                // Prefer message list/search tools when available; threads are less informative.
                const preferredMessageTool = (Array.isArray(rawTools) ? rawTools : [])
                    .map((t: any) => ({
                        t,
                        name: String(t?.slug || t?.name || t?.function?.name || '').toLowerCase(),
                    }))
                    .filter((x) => x.name)
                    .filter((x) => x.name.includes('message') && (x.name.includes('list') || x.name.includes('search')))
                    .filter((x) => !x.name.includes('send') && !x.name.includes('draft'))
                    .map((x) => x.t)[0];

                const tool = preferredMessageTool || pickBestToolForQuery(rawTools, effectiveUserMessage);
                console.log('[Agent Chat] Gmail tool selection', {
                    toolsFound: Array.isArray(rawTools) ? rawTools.length : 0,
                    selectedTool: tool ? String(tool?.slug || tool?.name || tool?.function?.name || '') : null,
                });
                if (!tool) {
                    directReply = 'Gmail is connected, but I could not find a Gmail “read/list/search messages” tool to fetch emails. Please reconnect Gmail or contact support.';
                } else {
                    const params = buildParamsFromSchema(tool, effectiveUserMessage);
                    const toolName = String(tool?.slug || tool?.name || tool?.function?.name || 'GMAIL_TOOL');
                    console.log('[Agent Chat] Executing Gmail tool', {
                        toolName,
                        params,
                    });
                    const toolResult = await executeTool(String(userId), 'gmail', tool, params, gmailConnectionId);

                    if (!toolResult.success) {
                        directReply = `Gmail integration failed while fetching emails (tool=${toolName}). Error: ${toolResult.error || 'Unknown error'}. Try reconnecting Gmail and retry.`;
                    } else {
                        gmailToolPayload = toolResult.result;
                        try {
                            const topKeys = toolResult.result && typeof toolResult.result === 'object' ? Object.keys(toolResult.result).slice(0, 12) : [];
                            const candidateCount = extractEmailCandidates(toolResult.result).length;
                            console.log('[Agent Chat] Gmail tool result summary', {
                                toolName,
                                topKeys,
                                candidateCount,
                            });
                        } catch {
                            // ignore
                        }
                        integrationsContextText = `\n\nINTEGRATIONS: Gmail tool result (tool=${toolName}, connectionId=${gmailConnectionId}):\n${formatToolResultForPrompt(toolResult.result)}`;
                        directReply = buildDeterministicGmailReply(toolResult.result);
                    }
                }
            }
        } catch (e: any) {
            directReply = `Gmail tool execution error: ${String(e?.message || e)}`;
        }
    }

    // 5. Fetch History
    const { data: history } = await supabaseAdmin
        .from('agent_messages')
        .select('role, content, attachments')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true })
        .limit(10);

    // 6. Build messages for OpenRouter
    const systemInstructionText = `You are an AI agent named "${agent.name}".
    
Instructions:
${agent.instructions}

${contextText ? "Use the provided context to answer the user's question accurately. If the answer is not in the context, you can use your general knowledge but prioritize the context." : ""}

If an INTEGRATIONS section is present in the user message context:
- If it contains an error or says Gmail is not connected, explain clearly what failed and what the user should do next.
- If it contains Gmail tool results, summarize the most relevant emails and answer the user's question using that data.`;

    // Build OpenRouter-compatible messages
    const messages: Array<{role: string, content: string}> = [
        { role: 'system', content: systemInstructionText }
    ];

    // Add history (excluding the current user message which was just inserted)
    const historyWithoutLast = (history || []).slice(0, -1);
    historyWithoutLast.forEach((msg: any) => {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    });

    // Add current user message with context
    messages.push({
        role: 'user',
        content: userMessage + contextText + integrationsContextText
    });

    let responseText = '';
    if (directReply) {
        console.log('[Agent Chat] Returning directReply (skipping OpenRouter)');
        responseText = directReply;
    } else {
        console.log('[Agent Chat] Using OpenRouter', {
            model: OPENROUTER_MODEL,
            emailIntent,
            messagePreview: String(userMessage || '').slice(0, 120),
        });
        responseText = await callOpenRouter(messages);
    }

    // 7. Save Assistant Response
    await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: responseText
    });

    // Credits: deduct + log usage event for Analytics
    if (orgCreditsBalance !== null) {
        try {
            const newBalance = Math.max(0, Number(orgCreditsBalance) - Number(creditsCharged));
            await supabaseAdmin
                .from('organization_credits')
                .update({ balance_credits: newBalance })
                .eq('organization_id', orgId);
        } catch (e: any) {
            console.warn('[API][agent-chat] Organization credits deduction failed', e?.message || e);
        }
    }

    try {
        await supabaseAdmin
            .from('usage_events')
            .insert({
                user_id: userId,
                organization_id: orgId,
                tool: `agent:${agentId}`,
                credits: creditsCharged,
                metadata: {
                    type: 'agent_chat',
                    modelId: agent?.model_config?.modelId || null,
                    integrationsUsed: directReply ? (gmailToolPayload ? ['gmail'] : ['gmail_error']) : [],
                },
            });
    } catch (e: any) {
        console.warn('[API][agent-chat] usage_events insert failed', e?.message || e);
    }

    return {
        sessionId: currentSessionId,
        response: responseText,
        sources: contextText ? "Knowledge Base" : null
    };
}
