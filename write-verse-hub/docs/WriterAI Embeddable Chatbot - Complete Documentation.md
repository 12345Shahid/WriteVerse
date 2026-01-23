WriterAI Embeddable Chatbot - Complete Documentation
Overview
The WriterAI Embeddable Chatbot allows you to embed an AI-powered chatbot widget on any website or application. Users can interact with the chatbot directly on your platform, and you can customize its appearance, behavior, and integrations.

Features
Core Functionality
Real-time Chat Interface — Multi-turn conversations with AI model

Custom Knowledge Base — Chatbot answers based on your uploaded documents

Brand Customization — Match your website's look and feel (colors, fonts, logo)

Conversation History — Users can view previous conversations

Analytics Tracking — Track conversations, user engagement, lead captures

Multi-language Support — Support for different languages (configurable)

File Attachments — Users can upload images/PDFs for context

Quick Replies — Pre-defined suggested responses for common questions

Advanced Features
Custom System Instructions — Define chatbot personality and behavior

Lead Capture Forms — Collect email, name, phone before/during chat

Feedback Ratings — Users can rate responses (CSAT tracking)

Conversation Export — Users can download chat history as PDF/TXT

Webhook Integration — Send conversation data to external systems

Rate Limiting — Prevent abuse (e.g., max 50 messages per hour)

Session Management — Preserve conversation context across page reloads

Mobile Responsive — Works perfectly on desktop, tablet, mobile

Installation
Method 1: Simple Script Embed (Recommended for Most Users)
Copy and paste this single line of code before the closing </body> tag on your website:

xml
<script src="https://writeral-api.com/embed/chatbot.js"></script>
<script>
  WriterAIChat.init({
    botId: 'YOUR_BOT_ID',
    apiKey: 'YOUR_PUBLIC_API_KEY'
  });
</script>
That's it! The chatbot widget will appear in the bottom-right corner of your website.

Method 2: React Component (For React/Next.js Applications)
bash
npm install @writerai/chatbot-embed
jsx
import { WriterAIChatbot } from '@writerai/chatbot-embed';

export default function App() {
  return (
    <WriterAIChatbot
      botId="YOUR_BOT_ID"
      apiKey="YOUR_PUBLIC_API_KEY"
      position="bottom-right"
    />
  );
}
Method 3: Advanced - Custom Container
Embed chatbot in a specific HTML element:

xml
<div id="my-chatbot-container" style="width: 100%; height: 600px;"></div>

<script src="https://writeral-api.com/embed/chatbot.js"></script>
<script>
  WriterAIChat.init({
    botId: 'YOUR_BOT_ID',
    apiKey: 'YOUR_PUBLIC_API_KEY',
    container: '#my-chatbot-container'
  });
</script>
Configuration Options
Basic Configuration
javascript
WriterAIChat.init({
  // Required
  botId: 'YOUR_BOT_ID',                    // Unique identifier for your chatbot
  apiKey: 'YOUR_PUBLIC_API_KEY',           // Public key for authentication

  // Appearance
  position: 'bottom-right',                // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
  width: '380px',                          // Widget width (default: 380px)
  height: '600px',                         // Widget height (default: 600px)
  theme: 'light',                          // 'light' or 'dark'

  // Colors & Branding
  primaryColor: '#007AFF',                 // Main chat bubble color
  secondaryColor: '#F2F2F7',               // Background color
  textColor: '#000000',                    // Primary text color
  accentColor: '#FF3B30',                  // Accent elements (buttons, links)
  logoUrl: 'https://yoursite.com/logo.png', // Brand logo in header
  botName: 'Support Assistant',            // Chatbot name shown in header

  // Behavior
  startMessage: 'Hi! How can I help you today?',  // First message from bot
  placeholder: 'Type your message...',    // Input placeholder text
  showTypingIndicator: true,              // Show "typing..." animation
  soundNotification: true,                // Play sound for new messages
  
  // Lead Capture
  collectEmail: false,                    // Ask for email before chat
  collectName: false,                     // Ask for name before chat
  collectPhone: false,                    // Ask for phone before chat

  // Analytics
  trackConversations: true,               // Send events to Mixpanel
  customUserId: user.id,                  // Link chat to your user ID
  customMetadata: {                       // Additional tracking data
    source: 'homepage',
    campaign: 'summer-promo'
  }
});
Customization Examples
Example 1: E-commerce Product Support
javascript
WriterAIChat.init({
  botId: 'ecommerce-support',
  apiKey: 'your-public-key',
  primaryColor: '#2E7D32',              // Green for trust
  botName: 'Product Support',
  startMessage: 'Welcome! Ask me about our products or your order.',
  collectEmail: true,                   // Collect for follow-up
  logoUrl: 'https://shop.com/logo.png',
  customMetadata: {
    source: 'product_page',
    category: 'electronics'
  }
});
Example 2: SaaS B2B Sales
javascript
WriterAIChat.init({
  botId: 'sales-qualification',
  apiKey: 'your-public-key',
  primaryColor: '#0066CC',              // Professional blue
  botName: 'Sales Assistant',
  startMessage: 'Looking for a demo? I can help qualify you.',
  collectEmail: true,
  collectName: true,
  collectPhone: true,                   // Important for B2B
  theme: 'dark',
  customMetadata: {
    source: 'pricing_page',
    intent: 'sales'
  }
});
Example 3: Content Marketing / Blog
javascript
WriterAIChat.init({
  botId: 'content-helper',
  apiKey: 'your-public-key',
  position: 'bottom-left',
  primaryColor: '#FF6B35',              // Warm orange
  botName: 'Content Assistant',
  startMessage: 'Have questions about this article? I can help!',
  collectEmail: false,                  // Not necessary for content
  theme: 'light',
  customMetadata: {
    source: 'blog',
    articleId: 'ai-trends-2025'
  }
});
Styling & CSS Customization
Custom CSS Variables
Override default styles using CSS:

css
:root {
  --writerai-primary: #007AFF;
  --writerai-secondary: #F2F2F7;
  --writerai-text: #000000;
  --writerai-accent: #FF3B30;
  --writerai-border-radius: 12px;
  --writerai-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --writerai-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
Custom CSS Class
Apply custom styles to specific elements:

css
/* Chat header */
.writerai-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
}

/* Chat messages */
.writerai-message-bot {
  background-color: #E3E3E3;
  border-radius: 12px;
}

.writerai-message-user {
  background-color: #007AFF;
  color: white;
  border-radius: 12px;
}

/* Input area */
.writerai-input-box {
  border-top: 2px solid #E0E0E0;
  padding: 12px;
}

/* Send button */
.writerai-send-button {
  background-color: #FF6B6B;
  hover: background-color: #FF5252;
}
Advanced Integration
Webhook Integration
Send conversation events to your backend:

javascript
WriterAIChat.init({
  botId: 'YOUR_BOT_ID',
  apiKey: 'YOUR_PUBLIC_API_KEY',
  webhooks: {
    onMessageSent: 'https://yoursite.com/api/chatbot-events',
    onConversationStart: 'https://yoursite.com/api/chatbot-events',
    onLeadCapture: 'https://yoursite.com/api/leads',
    onFeedback: 'https://yoursite.com/api/feedback'
  }
});
Webhook Payload Example (onMessageSent):

json
{
  "event": "message_sent",
  "botId": "YOUR_BOT_ID",
  "conversationId": "conv-12345",
  "message": "Can you help me with billing?",
  "sender": "user",
  "timestamp": "2025-11-26T10:20:00Z",
  "metadata": {
    "source": "homepage",
    "customUserId": "user-789"
  }
}
Analytics Events (Mixpanel)
Events automatically tracked to Mixpanel:

text
- chat_started: User opens chatbot
- message_sent: User sends message
- message_received: Bot responds
- lead_captured: User submits email/contact info
- csat_submitted: User rates response
- file_uploaded: User uploads attachment
- conversation_ended: Chat session ends
- fallback_triggered: Bot cannot answer
Track custom events:

javascript
WriterAIChat.trackEvent('custom_event', {
  botId: 'YOUR_BOT_ID',
  eventType: 'user_action',
  customData: 'your data here'
});
API Methods
Open/Close Chatbot Programmatically
javascript
// Open the chatbot
WriterAIChat.open();

// Close the chatbot
WriterAIChat.close();

// Toggle (open if closed, close if open)
WriterAIChat.toggle();

// Check if chatbot is open
const isOpen = WriterAIChat.isOpen(); // Returns true/false
Send Message Programmatically
javascript
// Send a message on behalf of user
WriterAIChat.sendMessage('What are your pricing plans?');

// Get conversation history
const history = WriterAIChat.getConversationHistory();
console.log(history); // Array of messages

// Clear conversation history
WriterAIChat.clearHistory();
Update Configuration
javascript
// Change theme dynamically
WriterAIChat.setTheme('dark');

// Update bot name
WriterAIChat.setBotName('New Assistant Name');

// Update colors
WriterAIChat.setColors({
  primaryColor: '#FF6B6B',
  secondaryColor: '#F8F9FA'
});
Destroy/Remove Chatbot
javascript
// Remove chatbot from page
WriterAIChat.destroy();
Lead Capture & Forms
Email Collection
javascript
WriterAIChat.init({
  botId: 'YOUR_BOT_ID',
  apiKey: 'YOUR_PUBLIC_API_KEY',
  collectEmail: true,
  emailPrompt: 'Please share your email to continue'
});
When user submits email, the event is sent:

javascript
WriterAIChat.on('leadCaptured', (leadData) => {
  console.log('Lead:', leadData);
  // {
  //   email: 'user@example.com',
  //   name: 'John Doe',
  //   phone: '+1234567890',
  //   timestamp: '2025-11-26T10:20:00Z'
  // }
  
  // Send to your CRM or database
  fetch('https://yoursite.com/api/leads', {
    method: 'POST',
    body: JSON.stringify(leadData)
  });
});
Conversation Export
Download Chat History
Users can download their conversation via:

javascript
// Programmatically trigger download
WriterAIChat.downloadConversation('pdf'); // 'pdf' or 'txt'

// Or use the UI button (appears in chatbot header)
Troubleshooting
Issue: Chatbot Not Appearing
Check:

Script is loaded: Open DevTools → Network tab → search "chatbot.js"

Bot ID and API Key are correct

API Key is public key, not secret key

No JavaScript errors: Check Console tab

Fix:

javascript
// Add debug mode
WriterAIChat.init({
  botId: 'YOUR_BOT_ID',
  apiKey: 'YOUR_PUBLIC_API_KEY',
  debug: true  // Logs all events to console
});
Issue: Messages Not Sending
Check:

API key is valid

Bot ID is correct

Network is working (check Network tab for failed requests)

Rate limit not exceeded (max 50 messages/hour by default)

Issue: Analytics Not Tracking
Check:

Mixpanel is enabled (default: true)

Your Mixpanel project token is configured in WriterAI dashboard

User has not blocked analytics cookies

Security & Privacy
Data Handling
User Messages: Encrypted in transit (HTTPS)

Conversation History: Stored securely on WriterAI servers

Personal Data: Never shared with third parties

GDPR Compliant: Users can request data deletion

API Keys
Public API Key: Safe to embed (view-only access)

Secret API Key: Keep confidential (never share in frontend code)

Rotate keys regularly from WriterAI dashboard

Rate Limiting
Default limits to prevent abuse:

50 messages per hour per user

1000 messages per day per chatbot

Configure custom limits in dashboard.

Performance Optimization
Lazy Loading
Chatbot script loads asynchronously (doesn't block page load).

Bundle Size
Chatbot script: ~25KB gzipped

Minimal impact on page performance

Caching
Browser caches chatbot assets for 30 days (improves subsequent visits).

Mobile Responsiveness
Chatbot automatically adapts to device:

Desktop: Fixed position (bottom-right, 380px wide)

Tablet: Slightly smaller, optimized touch targets

Mobile: Full-width, slides up from bottom

No additional configuration needed.

Support & Documentation
Dashboard: https://writeral-api.com/dashboard

API Documentation: https://writeral-api.com/docs/api

Help Center: https://help.writeral-api.com

Email Support: support@writeral-api.com

Discord Community: https://discord.gg/writeral

Version History
Version	Release Date	Changes
1.0.0	Nov 26, 2025	Initial release
1.1.0	Dec 10, 2025 (planned)	File attachment support
1.2.0	Dec 24, 2025 (planned)	Custom agents in chat
2.0.0	Jan 15, 2026 (planned)	Multi-language support
License & Terms
Free to embed on unlimited websites

Usage governed by WriterAI Terms of Service

Commercial use allowed with appropriate plan

Quick Start Checklist
 Create chatbot in WriterAI dashboard

 Copy Bot ID and Public API Key

 Paste embed script on your website

 Customize colors and branding (optional)

 Test chatbot functionality

 Set up analytics tracking (Mixpanel)

 Configure webhooks if needed (optional)

 Deploy to production

 Monitor conversations in dashboard

 Gather user feedback and iterate

Code Examples
WordPress (using code snippet plugin)
php
<script src="https://writeral-api.com/embed/chatbot.js"></script>
<script>
  WriterAIChat.init({
    botId: 'wordpress-blog',
    apiKey: 'pk_live_xxx',
    primaryColor: '#0066CC',
    botName: 'Blog Assistant',
    customMetadata: {
      source: 'wordpress'
    }
  });
</script>
Shopify (in theme.liquid)
xml
{% if settings.enable_chatbot %}
  <script src="https://writeral-api.com/embed/chatbot.js"></script>
  <script>
    WriterAIChat.init({
      botId: '{{ settings.chatbot_id }}',
      apiKey: '{{ settings.chatbot_api_key }}',
      primaryColor: '{{ settings.theme_accent }}',
      collectEmail: true,
      customMetadata: {
        source: 'shopify'
      }
    });
  </script>
{% endif %}
HTML + Bootstrap
xml
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --writerai-primary: #0066CC;
      --writerai-secondary: #F8F9FA;
    }
  </style>
</head>
<body>
  <div class="container py-5">
    <h1>Welcome to Our Support</h1>
    <p>Chat with our AI assistant below.</p>
  </div>

  <script src="https://writeral-api.com/embed/chatbot.js"></script>
  <script>
    WriterAIChat.init({
      botId: 'support-bot',
      apiKey: 'pk_live_xxx',
      position: 'bottom-right'
    });
  </script>
</body>
</html>
Last Updated: November 26, 2025
Maintained By: WriterAI Team



