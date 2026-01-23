import { GoogleGenerativeAI, FunctionCallingMode } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { searchKnowledge } from './knowledge-base.js';
import { recordUsage } from './meter.js';
import * as composio from './lib/composio.js';

// Init clients
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Get connected Composio apps for an agent
 */
async function getAgentConnectedApps(agentId) {
  if (!supabaseAdmin) return [];
  
  try {
    console.log('[Agent][Composio] Fetching integrations for agent:', agentId);
    
    const { data: integrations, error } = await supabaseAdmin
      .from('agent_integrations')
      .select('app_name, connection_id, connection_status')
      .eq('agent_id', agentId)
      .eq('connection_status', 'connected');
    
    if (error) {
      console.error('[Agent][Composio] Query error:', error.message);
      return [];
    }
    
    console.log('[Agent][Composio] Found integrations:', integrations?.length || 0, integrations);
    return integrations?.map(i => ({ appName: i.app_name, connectionId: i.connection_id })) || [];
  } catch (error) {
    console.warn('[Agent][Composio] Failed to fetch integrations:', error.message);
    return [];
  }
}

/**
 * Execute a Composio tool called by the agent
 */
async function executeAgentTool(userId, orgId, agentId, toolName, params, connectionId) {
  console.log('[Agent][Tool] Executing:', {
    tool: toolName,
    agentId: agentId?.substring(0, 8) + '...',
    connectionId: connectionId?.substring(0, 8) + '...'
  });

  try {
    const result = await composio.executeTool(userId, toolName, params, {
      source: 'agent',
      agentId,
      orgId,
      connectionId, // Pass the resolved connection ID
      appName: toolName.split('_')[0] // Provide app name hint
    });

    // Log to database
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.rpc('log_tool_execution', {
          p_organization_id: orgId,
          p_user_id: userId,
          p_source_type: 'agent',
          p_source_id: agentId,
          p_source_name: `Agent Tool Call`,
          p_tool_name: toolName,
          p_app_name: toolName.split('_')[0],
          p_input_params: params || {},
          p_output_result: result.result || null,
          p_status: result.success ? 'success' : 'error',
          p_error_message: result.error || null,
          p_error_code: result.errorCode || null,
          p_execution_time_ms: result.executionTime || null
        });
      } catch (logErr) {
        console.warn('[Agent][Tool] Failed to log execution:', logErr.message);
      }
    }

    return result;
  } catch (error) {
    console.error('[Agent][Tool][ERROR]', {
      tool: toolName,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

export async function chatWithAgent(userId, orgId, agentId, userMessage, sessionId = null, attachments = [], options = {}) {
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

    // CHECK ESCALATION STATUS
    // If session is escalated or closed, do not generate AI response
    // But we still saved the user message above so support team sees it.
    const { data: currentSession } = await supabaseAdmin
        .from('agent_sessions')
        .select('status')
        .eq('id', currentSessionId)
        .single();

    if (currentSession?.status === 'escalated' || currentSession?.status === 'closed') {
        console.log(`[Agent][Chat] identifying session ${currentSessionId} as ${currentSession.status}. Skipping AI response.`);
        return { 
            success: true, 
            response: null, 
            status: currentSession.status,
            sessionId: currentSessionId 
        };
    }

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
        .order('created_at', { ascending: true })
        .limit(10);

    // 6. Get Composio tools for agent (if any connected apps)
    let composioTools = [];
    let geminiTools = null;
    let connectedApps = []; // Store full connection objects
    
    if (composio.isComposioEnabled()) {
        try {
            connectedApps = await getAgentConnectedApps(agentId);
            if (connectedApps.length > 0) {
                const appNames = connectedApps.map(a => a.appName);
                console.log('[Agent][Composio] Connected apps:', appNames.join(', '));
                composioTools = await composio.getToolsForAgent(userId, appNames);
                
                if (composioTools.length > 0) {
                    // Format for Gemini function calling
                    geminiTools = [{
                        functionDeclarations: composioTools.map(tool => ({
                            name: tool.name,
                            description: tool.description,
                            parameters: sanitizeSchema(tool.parameters) // Ensure clean schema
                        }))
                    }];
                    console.log('[Agent][Composio] Tools available:', composioTools.length);
                }
            }
        } catch (e) {
            console.warn('[Agent][Composio] Failed to load tools:', e.message);
        }
    }

    // Always add the native Escalation tool
    const escalationTool = {
        name: 'handoff_to_human',
        description: 'Escalate this conversation to a human support agent. Use this when the user explicitly asks for a human, or if you are unable to help after multiple attempts.',
        parameters: { type: 'object', properties: {}, required: [] } // No params needed
    };

    if (geminiTools) {
        geminiTools[0].functionDeclarations.push(escalationTool);
    } else {
        geminiTools = [{
            functionDeclarations: [escalationTool]
        }];
    }

    // Add Email Tool
    const emailTool = {
        name: 'send_email',
        description: 'Send an email to the user or a specific recipient. Use this to send transcripts, summaries, or follow-up information.',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'The email address to send to. If not provided, ask the user for their email.' },
                subject: { type: 'string', description: 'Subject of the email.' },
                html: { type: 'string', description: 'HTML content of the email body. Use formatted HTML.' }
            },
            required: ['to', 'subject', 'html']
        }
    };
    geminiTools[0].functionDeclarations.push(emailTool);

    // Add generic CRM Tool (works with any connected CRM: HubSpot, Salesforce, Pipedrive)
    // The tool only shows if CRM is connected, otherwise agent knows it's not available
    const crmConnected = connectedApps.some(c => 
        ['HUBSPOT', 'SALESFORCE', 'PIPEDRIVE'].includes(c.appName.toUpperCase())
    );
    
    if (crmConnected) {
        const crmTool = {
            name: 'save_to_crm',
            description: 'Save lead/contact information to the connected CRM (HubSpot, Salesforce, or Pipedrive). Use this when you have collected lead information (name, email, phone, company) from a user and want to save it for follow-up.',
            parameters: {
                type: 'object',
                properties: {
                    email: { type: 'string', description: 'Email address of the contact (required)' },
                    firstname: { type: 'string', description: 'First name of the contact' },
                    lastname: { type: 'string', description: 'Last name of the contact' },
                    phone: { type: 'string', description: 'Phone number' },
                    company: { type: 'string', description: 'Company name' },
                    notes: { type: 'string', description: 'Notes about the contact or conversation summary' }
                },
                required: ['email']
            }
        };
        geminiTools[0].functionDeclarations.push(crmTool);
    }

    // Build dynamic CRM capability info for system prompt
    const crmInfo = crmConnected 
        ? `\n\nCRM INTEGRATION: You have save_to_crm tool available. When a user shares their contact info (email, name, etc.), you can offer to save it to the CRM for follow-up.`
        : `\n\nCRM INTEGRATION: No CRM is connected to this agent. If a user asks to save their info to CRM, politely explain that CRM integration hasn't been set up yet, but you can still help them via email or the standard chat.`;

    // 7. Build Prompt
    const systemInstructionText = `You are an AI agent named "${agent.name}".
    
    Instructions:
    ${agent.instructions}
    ${crmInfo}
    
    ${contextText ? "Use the provided context to answer the user's question accurately. If the answer is not in the context, you can use your general knowledge but prioritize the context." : ""}
    
    ${composioTools.length > 0 ? `\nYou have access to the following tools to help the user. Use them when appropriate:\n${composioTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}\n\nWhen you want to use a tool, call it as a function. After the tool returns, summarize the result for the user.` : ""}
    `;

    // Initialize model with optional tools
    const modelConfig = {
        model: "gemini-2.0-flash-exp", // The only available model on v1beta for this user
    };

    // Add tools to model config if available
    if (geminiTools) {
        modelConfig.tools = geminiTools;
        modelConfig.toolConfig = {
            functionCallingConfig: {
                mode: FunctionCallingMode.AUTO
            }
        };
    }

    // Use v1beta for better tool support
    const model = genAI.getGenerativeModel(modelConfig, { apiVersion: 'v1beta' });
    
    // Construct chat history for Gemini
    const chatHistory = (history || []).map(msg => {
        const parts = [{ text: msg.content }];
        if (msg.attachments && Array.isArray(msg.attachments)) {
             msg.attachments.forEach(att => {
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
    
    // Prepend system instruction
    previousHistory = [
        { role: 'user', parts: [{ text: systemInstructionText }] },
        { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
        ...previousHistory
    ];
    
    // Prepare current message parts
    const currentParts = [{ text: userMessage + contextText }];
    if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
            // Handle URL-based image attachments
            if (att.url && att.type && att.type.startsWith('image/')) {
                try {
                    // Fetch image and convert to base64 for Gemini Vision
                    const imageResponse = await fetch(att.url);
                    const arrayBuffer = await imageResponse.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    currentParts.push({
                        inlineData: {
                            mimeType: att.type,
                            data: base64
                        }
                    });
                    console.log('[Agents] Added image attachment from URL:', att.url);
                } catch (fetchErr) {
                    console.warn('[Agents] Failed to fetch image from URL:', att.url, fetchErr.message);
                    currentParts[0].text += `\n\nImage URL: ${att.url}`;
                }
            }
            // Handle text-based file attachments (md, txt, csv, json, etc.)
            else if (att.url && att.type && (
                att.type.startsWith('text/') || 
                att.type === 'application/json' ||
                att.type === 'application/javascript'
            )) {
                try {
                    const fileResponse = await fetch(att.url);
                    const fileContent = await fileResponse.text();
                    const fileName = att.name || 'file';
                    const truncatedContent = fileContent.length > 10000 
                        ? fileContent.substring(0, 10000) + '\n\n... [content truncated, showing first 10000 characters]'
                        : fileContent;
                    currentParts[0].text += `\n\n--- File: ${fileName} ---\n${truncatedContent}\n--- End of File ---`;
                    console.log('[Agents] Added text file content:', fileName, `(${fileContent.length} chars)`);
                } catch (fetchErr) {
                    console.warn('[Agents] Failed to fetch text file:', att.url, fetchErr.message);
                    currentParts[0].text += `\n\nFile attached: ${att.name || att.url} (could not read content)`;
                }
            }
            // Handle base64 content attachments (from direct upload)
            else if (att.content && att.type) {
                currentParts.push({
                    inlineData: {
                        mimeType: att.type,
                        data: att.content.split(',')[1] || att.content
                    }
                });
            }
            // Handle other file types (PDFs, docs, etc.) - just mention them
            else if (att.url) {
                currentParts[0].text += `\n\nFile attached: ${att.name || att.url} (binary file - cannot read content directly)`;
            }
        }
    }

    // 8. Generate response (with potential tool calls)
    let responseText = '';
    let toolsUsed = [];
    
    try {
        // First call - may return tool calls
        const generateConfig = {
            contents: [...previousHistory, { role: 'user', parts: currentParts }],
        };
        
        
        // Tools are now configured in the model instance (v1beta)
        // so we don't need to pass them in generateConfig for this call


        let result = await model.generateContent(generateConfig);
        let response = result.response;

        // Check for function calls
        const functionCalls = response.functionCalls();
        
        if (functionCalls && functionCalls.length > 0) {
            console.log('[Agent][FunctionCall] Tools requested:', functionCalls.length);
            
            // Execute each tool call
            const toolResults = [];
            for (const fc of functionCalls) {
                console.log('[Agent][FunctionCall] Executing:', fc.name);

                // Handle Native Tools (Escalation)
                if (fc.name === 'handoff_to_human') {
                    console.log('[Agent][Escalation] Handing off session', currentSessionId);
                    
                    // Update session status
                    await supabaseAdmin
                        .from('agent_sessions')
                        .update({ status: 'escalated' })
                        .eq('id', currentSessionId);

                    // Trigger Novu Notification if available
                    if (options?.novu) {
                        try {
                            // Find organization members to notify (simplified: notify all admins/owners of the org)
                            // For now, we'll just trigger for the organization owner or a generic subscriber
                            // You typically want to notify a specific subscriberId (userId of admin)
                            // We can fetch org owner:
                            const { data: org } = await supabaseAdmin.from('organizations').select('created_by').eq('id', orgId).single();
                            const targetUserId = org?.created_by;

                            if (targetUserId) {
                                await options.novu.trigger('agent-escalation', {
                                    to: {
                                        subscriberId: targetUserId,
                                    },
                                    payload: {
                                        sessionId: currentSessionId,
                                        agentId: agentId,
                                        agentName: agent.name,
                                        message: userMessage
                                    },
                                });
                                console.log('[Agent][Novu] Notification triggered for', targetUserId);
                            }
                        } catch (e) {
                            console.error('[Agent][Novu] Failed to trigger notification:', e.message);
                        }
                    }

                    toolResults.push({
                        name: fc.name,
                        success: true,
                        result: { message: "Session escalated to human support. Updates sent to team inbox." }
                    });
                    toolsUsed.push(fc.name);
                    continue; // Skip Composio execution for this tool
                }

                // Handle Send Email Tool
                if (fc.name === 'send_email') {
                    console.log('[Agent][Email] Sending email to', fc.args.to);
                    try {
                        const emailRes = await fetch(`${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/email/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: fc.args.to,
                                subject: fc.args.subject,
                                html: fc.args.html
                            })
                        });
                        
                        if (!emailRes.ok) {
                            const errData = await emailRes.json();
                            throw new Error(errData.error || 'Failed to send email');
                        }
                        
                        toolResults.push({
                            name: fc.name,
                            success: true,
                            result: { message: "Email sent successfully." }
                        });
                    } catch (err) {
                        toolResults.push({
                            name: fc.name,
                            success: false,
                            error: err.message
                        });
                    }
                    toolsUsed.push(fc.name);
                    continue; 
                }

                // Handle generic CRM Tool (supports HubSpot, Salesforce, Pipedrive)
                if (fc.name === 'save_to_crm' || fc.name === 'create_hubspot_contact') {
                    console.log('[Agent][CRM] Saving contact:', fc.args.email);
                    try {
                        // Find any connected CRM (priority: HubSpot > Salesforce > Pipedrive)
                        const crmPriority = ['HUBSPOT', 'SALESFORCE', 'PIPEDRIVE'];
                        let crmConn = null;
                        for (const crm of crmPriority) {
                            crmConn = connectedApps.find(c => c.appName.toUpperCase() === crm);
                            if (crmConn) break;
                        }
                        
                        if (!crmConn) {
                            throw new Error('No CRM connected. Please connect a CRM (HubSpot, Salesforce, or Pipedrive) in Settings → Embed Settings → CRM Integration.');
                        }

                        const crmName = crmConn.appName.toUpperCase();
                        console.log(`[Agent][CRM] Using ${crmName} for contact creation`);
                        
                        const { executeTool } = await import('./lib/composio.js');
                        let result;
                        let successMessage;

                        // Route to appropriate CRM API
                        switch (crmName) {
                            case 'HUBSPOT':
                                result = await executeTool(userId, 'HUBSPOT_CREATE_CONTACT', {
                                    email: fc.args.email,
                                    firstname: fc.args.firstname || '',
                                    lastname: fc.args.lastname || '',
                                    phone: fc.args.phone || '',
                                    company: fc.args.company || '',
                                    hs_lead_status: 'NEW'
                                }, { connectionId: crmConn.connectionId, appName: 'hubspot' });
                                successMessage = `Contact saved to HubSpot CRM.`;
                                break;
                                
                            case 'SALESFORCE':
                                result = await executeTool(userId, 'SALESFORCE_CREATE_CONTACT', {
                                    Email: fc.args.email,
                                    FirstName: fc.args.firstname || '',
                                    LastName: fc.args.lastname || 'Unknown',
                                    Phone: fc.args.phone || '',
                                    Account: { Name: fc.args.company || '' }
                                }, { connectionId: crmConn.connectionId, appName: 'salesforce' });
                                successMessage = `Contact saved to Salesforce.`;
                                break;
                                
                            case 'PIPEDRIVE':
                                result = await executeTool(userId, 'PIPEDRIVE_CREATE_PERSON', {
                                    name: `${fc.args.firstname || ''} ${fc.args.lastname || ''}`.trim() || 'Lead',
                                    email: [{ value: fc.args.email, primary: true }],
                                    phone: fc.args.phone ? [{ value: fc.args.phone, primary: true }] : undefined,
                                    org_id: null // Would need org lookup for company
                                }, { connectionId: crmConn.connectionId, appName: 'pipedrive' });
                                successMessage = `Contact saved to Pipedrive.`;
                                break;
                                
                            default:
                                throw new Error(`Unsupported CRM: ${crmName}`);
                        }

                        if (result?.success) {
                            console.log(`[Agent][CRM] ${crmName} contact created:`, result.result);
                            toolResults.push({
                                name: fc.name,
                                success: true,
                                result: { message: successMessage }
                            });
                        } else {
                            throw new Error(result?.error || 'Failed to create contact in CRM');
                        }
                    } catch (err) {
                        console.error('[Agent][CRM] Error:', err.message);
                        toolResults.push({
                            name: fc.name,
                            success: false,
                            error: err.message
                        });
                    }
                    toolsUsed.push(fc.name);
                    continue; 
                }
                
                // Find connection for this tool (Composio)
                const appNameGuess = fc.name.split('_')[0].toUpperCase();
                const conn = connectedApps.find(c => c.appName.toUpperCase() === appNameGuess);
                const connectionId = conn?.connectionId;

                const toolResult = await executeAgentTool(
                    userId, 
                    orgId, 
                    agentId, 
                    fc.name, 
                    fc.args,
                    connectionId
                );
                
                toolResults.push({
                    name: fc.name,
                    success: toolResult.success,
                    result: toolResult.result,
                    error: toolResult.error
                });
                
                toolsUsed.push(fc.name);
            }
            
            // Send tool results back to model for final response
            const functionResponseParts = toolResults.map(tr => ({
                functionResponse: {
                    name: tr.name,
                    response: tr.success 
                        ? { result: JSON.stringify(tr.result) }
                        : { error: tr.error }
                }
            }));

            const followUpResult = await model.generateContent({
                contents: [
                    ...previousHistory,
                    { role: 'user', parts: currentParts },
                    { role: 'model', parts: response.candidates[0].content.parts },
                    { role: 'user', parts: functionResponseParts }
                ]
            });
            
            responseText = followUpResult.response.text();
        } else {
            // No tool calls, just get the text response
            responseText = response.text();
        }
    } catch (genError) {
        console.error('[Agent][Generate][ERROR]', genError.message);
        // Fallback: try without tools
        if (geminiTools) {
            console.log('[Agent][Generate] Retrying without tools (fresh model)...');
            // Create a fresh model instance WITHOUT tools for fallback
            const fallbackModel = genAI.getGenerativeModel(
                { model: modelConfig.model },
                { apiVersion: 'v1beta' }
            );
            const fallbackResult = await fallbackModel.generateContent({
                contents: [...previousHistory, { role: 'user', parts: currentParts }]
            });
            responseText = fallbackResult.response.text();
        } else {
            throw genError;
        }
    }

    // 9. Save Assistant Response
    // NOTE: metadata column is missing in prod DB, so we omit usage tracking for now
    const { error: saveError } = await supabaseAdmin.from('agent_messages').insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: responseText
        // metadata: toolsUsed.length > 0 ? { toolsUsed } : null // TODO: Enable after SQL53 migration
    });

    if (saveError) {
        console.error('[Agent][SaveMsg][ERROR] Failed to save assistant response:', saveError);
    }

    // 10. Track Usage
    try {
        const estimatedTokens = Math.ceil(responseText.length / 4);
        await recordUsage({
            organization_id: orgId,
            user_id: userId,
            tool: `agent:${agentId}`,
            provider: 'google',
            action: 'chat',
            units: estimatedTokens,
            credits: estimatedTokens,
            metadata: { 
                agentId, 
                sessionId: currentSessionId,
                toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
            }
        });
    } catch (e) {
        console.warn('[Agent] Failed to record usage', e);
    }

    return {
        sessionId: currentSessionId,
        response: responseText,
        sources: contextText ? "Knowledge Base" : null,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
    };
}

// Helper to remove unsupported fields from JSON schema for Gemini
function sanitizeSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;
    if (Array.isArray(schema)) return schema; // Arrays like 'required' don't need sanitization usually
    
    // Whitelist valid keys for Gemini/OpenAPI schema
    const validKeys = [
        'type', 'format', 'description', 'properties', 
        'required', 'items', 'enum', 'nullable', 'default'
    ];
    
    const clean = {};
    for (const key in schema) {
        if (!validKeys.includes(key)) continue;

        if (key === 'properties' && schema[key] && typeof schema[key] === 'object') {
            clean[key] = {};
            for (const propName in schema[key]) {
                 clean[key][propName] = sanitizeSchema(schema[key][propName]);
            }
        } else if (key === 'items' && schema[key] && typeof schema[key] === 'object') {
            clean[key] = sanitizeSchema(schema[key]);
        } else {
            clean[key] = schema[key];
        }
    }
    return clean;
}
