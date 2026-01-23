import 'dotenv/config';
import { trackEvent, identifyUser } from './lib/mixpanel.js';

console.log('🚀 Starting Full Analytics Test...');

if (!process.env.MIXPANEL_TOKEN) {
    console.error('❌ ERROR: MIXPANEL_TOKEN missing');
    process.exit(1);
}

const MOCK_USER = 'test_user_analytics_001';
const MOCK_ORG = 'test_org_analytics_001';

// 1. Identify User
identifyUser(MOCK_USER, {
    $name: 'Test Analytics User',
    $email: 'test@analytics.com',
    plan: 'pro'
});
console.log('✅ Identified User');

// 2. Simulate Tool Usage
trackEvent('tool_used', MOCK_USER, {
    tool: 'blog_post',
    orgId: MOCK_ORG,
    credits: 10,
    model: 'gemini-2.0-flash',
    tokenCount: 500
});
console.log('✅ Tracked Tool Usage');

// 3. Simulate Workflow
trackEvent('workflow_executed', MOCK_USER, {
    workflowId: 'wf_123',
    orgId: MOCK_ORG
});
console.log('✅ Tracked Workflow Execution');

// 4. Simulate Internal Chat
trackEvent('internal_agent_chat', MOCK_USER, {
    agentId: 'agent_007',
    orgId: MOCK_ORG,
    messageLength: 42
});
console.log('✅ Tracked Internal Chat');

// 5. Simulate Embed Chat
trackEvent('embed_message_sent', 'session_embed_999', {
    botId: 'bot_embed_888',
    charCount: 15
});
console.log('✅ Tracked Embed Chat');

console.log('🎉 All events sent! Check Mixpanel Dashboard to verify.');
