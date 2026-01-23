import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Use OpenRouter like other endpoints
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
}

async function validateApiKey(apiKey: string) {
  if (!apiKey || !supabaseAdmin) return null;
  
  const { data, error } = await supabaseAdmin
    .from('organization_api_keys')
    .select('organization_id, name')
    .eq('public_key', apiKey)
    .single();
    
  if (error || !data) return null;
  return data.organization_id;
}

// Call OpenRouter API with configurable model
async function callOpenRouter(messages: Array<{role: string, content: string}>, model?: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const useModel = model || OPENROUTER_MODEL;
  console.log('[Embed Chat] Using model:', useModel);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://writerai.app',
      'X-Title': 'WriterAI Embed Chat',
    },
    body: JSON.stringify({
      model: useModel,
      messages,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const apiKey = (req.headers['x-api-key'] as string) || req.body?.apiKey;
  const { botId, message, sessionId, lead } = req.body || {};

  if (!apiKey) return res.status(401).json({ error: 'MISSING_API_KEY' });
  if (!botId || !message) return res.status(400).json({ error: 'INVALID_REQUEST' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  const orgId = await validateApiKey(apiKey);
  if (!orgId) return res.status(401).json({ error: 'INVALID_API_KEY' });

  try {
    console.log('[Embed Chat] Looking up bot:', { botId, orgId });
    
    // Get agent config
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('agents')
      .select('id, name, instructions, model_config, organization_id')
      .eq('id', botId)
      .eq('organization_id', orgId)
      .single();

    console.log('[Embed Chat] Bot lookup result:', { 
      found: !!agent, 
      agentId: agent?.id,
      agentOrgId: agent?.organization_id,
      error: agentErr?.message || null 
    });

    if (agentErr || !agent) {
      console.error('[Embed Chat] BOT_NOT_FOUND:', { botId, orgId, error: agentErr });
      return res.status(404).json({ error: 'BOT_NOT_FOUND', details: 'Bot not found for this organization' });
    }

    // Get or create session
    let currentSessionId = sessionId;
    let isSessionEscalated = false;
    
    if (!currentSessionId) {
      console.log('[Embed Chat] Creating new session for embed chat');
      
      // Format title with name and email for leadbase
      const leadName = lead?.name || '';
      const leadEmail = lead?.email || 'Anonymous';
      const sessionTitle = leadName 
        ? `Embed Chat: ${leadName} <${leadEmail}>`
        : `Embed Chat: ${leadEmail}`;
      
      const { data: newSession, error: sessionErr } = await supabaseAdmin
        .from('agent_sessions')
        .insert({
          agent_id: botId,
          title: sessionTitle
        })
        .select('id')
        .single();
      
      if (sessionErr || !newSession) {
        console.error('[Embed Chat] Session creation failed:', sessionErr);
        throw new Error(`Failed to create session: ${sessionErr?.message || 'Unknown error'}`);
      }
      
      console.log('[Embed Chat] Session created:', newSession.id);
      currentSessionId = newSession.id;
    } else {
      // Check if existing session is escalated
      const { data: existingSession } = await supabaseAdmin
        .from('agent_sessions')
        .select('is_escalated')
        .eq('id', currentSessionId)
        .single();
      
      isSessionEscalated = existingSession?.is_escalated === true;
      console.log('[Embed Chat] Session escalation status:', isSessionEscalated);
    }

    // If session is escalated, store message but don't respond with AI
    if (isSessionEscalated) {
      // Store user message
      await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'user',
        content: message
      });
      
      const waitingResponse = `Your conversation has been assigned to a human agent. They will respond to your message soon. Please wait for their reply.`;
      
      // Store the waiting message
      await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: waitingResponse,
        metadata: { is_system: true }
      });
      
      return res.json({
        response: waitingResponse,
        sessionId: currentSessionId,
        escalated: true,
        waitingForHuman: true
      });
    }

    // Get conversation history (last 10 messages)
    const { data: history } = await supabaseAdmin
      .from('agent_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build messages for OpenRouter
    const messages: Array<{role: string, content: string}> = [
      { role: 'system', content: agent.instructions || 'You are a helpful assistant.' },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    // Store user message
    await supabaseAdmin.from('agent_messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: message
    });

    // Check for human escalation request
    const escalationPhrases = [
      'human support', 'talk to human', 'speak to human', 'real person', 
      'real agent', 'human agent', 'live agent', 'talk to someone', 
      'need human', 'want human', 'connect me to', 'transfer me'
    ];
    const lowerMessage = message.toLowerCase();
    const isEscalationRequest = escalationPhrases.some(phrase => lowerMessage.includes(phrase));

    if (isEscalationRequest) {
      console.log('[Embed Chat] Human escalation requested, flagging session');
      
      // Update session to mark as escalated
      const { error: escalationError } = await supabaseAdmin
        .from('agent_sessions')
        .update({ is_escalated: true })
        .eq('id', currentSessionId);
      
      if (escalationError) {
        console.error('[Embed Chat] Failed to set escalation flag:', escalationError);
      } else {
        console.log('[Embed Chat] Session escalated successfully:', currentSessionId);
      }

      const escalationResponse = `✅ **Your request has been escalated to a human agent.**

I've assigned your conversation to our support team. A team member will review your chat history and respond directly here.

**What happens next:**
- A human agent will take over this conversation
- You'll receive their response in this chat
- Average response time: Within a few hours during business hours

In the meantime, feel free to share any additional details about what you need help with.`;
      
      // Store escalation response
      await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: escalationResponse
      });

      return res.json({
        response: escalationResponse,
        sessionId: currentSessionId,
        escalated: true
      });
    }

    console.log('[Embed Chat] Calling OpenRouter with', messages.length, 'messages');
    
    // Call OpenRouter with agent's configured model
    const agentModel = agent.model_config?.model || agent.model_config?.modelId;
    const responseContent = await callOpenRouter(messages, agentModel);

    console.log('[Embed Chat] Got response, length:', responseContent.length);

    // Store assistant message
    await supabaseAdmin.from('agent_messages').insert({
      session_id: currentSessionId,
      role: 'assistant',
      content: responseContent
    });

    res.json({
      response: responseContent,
      sessionId: currentSessionId
    });
  } catch (e: any) {
    console.error('Embed Chat Error:', e);
    res.status(500).json({ error: e.message });
  }
}
