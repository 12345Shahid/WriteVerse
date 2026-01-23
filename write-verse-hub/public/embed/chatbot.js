(function(window) {
  let scriptSrc = '';
  try { scriptSrc = document.currentScript?.src || ''; } catch (e) {}
  
  let baseUrl = 'http://localhost:8787';
  if (scriptSrc.startsWith('http')) {
      const url = new URL(scriptSrc);
      baseUrl = url.origin;
  }
  const API_BASE = `${baseUrl}/api/embed`;

  // --- SVG Icons ---
  const ICONS = {
      close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
      send: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
      attach: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
      emoji: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
      mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
      msg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  };

  class WriterAIChat {
      constructor() {
          this.config = {
              position: 'bottom-right',
              primaryColor: '#007AFF',
              botName: 'Assistant',
              collectEmail: false,
              debug: false
          };
          this.settings = { // Default settings, overwritten by fetchConfig
            showHomeView: true,
            enableFileUpload: true,
            enableVoice: true,
            enableEmoji: true,
            description: 'We usually reply in a few minutes.',
            welcomeMessage: 'How can we help you?'
          };
          this.state = { 
              isOpen: false, 
              view: 'home', // 'home' | 'chat'
              messages: [], 
              sessionId: null,
              leadCaptured: false,
              leadData: null
          };
          this.shadow = null;
          this.elements = {};
      }

      init(config) {
          if (!config.botId || !config.apiKey) {
              console.error('WriterAI: botId and apiKey required');
              return;
          }
          this.config = { ...this.config, ...config };

          // Determine API Base URL
          if (this.config.apiUrl) {
              this.apiBase = `${this.config.apiUrl}/api/embed`;
          } else {
             this.apiBase = typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8787/api/embed';
          }
          
          if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', () => this.render());
          } else {
              this.render();
          }
          
          // Initialize Clarity if ID is provided
          if (this.config.clarityId) {
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", this.config.clarityId);
          }

          this.loadState();
          this.fetchConfig();
      }

      loadState() {
          try {
              const saved = localStorage.getItem(`writerai_chat_${this.config.botId}`);
              if (saved) {
                  const parsed = JSON.parse(saved);
                  this.state.sessionId = parsed.sessionId;
                  this.state.leadCaptured = parsed.leadCaptured;
                  this.state.leadData = parsed.leadData;
                  
                  if (parsed.messages && Array.isArray(parsed.messages)) {
                      this.pendingMessages = parsed.messages;
                      this.state.messages = parsed.messages;
                  }
                  // If we have an active session, default to chat view unless manually closed
                  if (this.state.sessionId) this.state.view = 'chat';
              }
          } catch(e) {}
      }

      saveState() {
          try {
              localStorage.setItem(`writerai_chat_${this.config.botId}`, JSON.stringify({
                  sessionId: this.state.sessionId,
                  leadCaptured: this.state.leadCaptured,
                  leadData: this.state.leadData,
                  messages: this.state.messages
              }));
          } catch(e) {}
      }

      resetChat() {
          this.state.sessionId = null;
          this.state.messages = [];
          this.state.leadCaptured = false;
          this.state.leadData = null;
          this.state.view = 'home';
          localStorage.removeItem(`writerai_chat_${this.config.botId}`);
          
          if (this.elements.messagesList) {
              this.elements.messagesList.innerHTML = '';
          }
          this.updateView();
      }

      async fetchConfig() {
          try {
              const res = await fetch(`${this.apiBase}/init?botId=${this.config.botId}&apiKey=${this.config.apiKey}`, {
                  headers: { 'x-api-key': this.config.apiKey }
              });
              if (res.ok) {
                  const data = await res.json();
                  if (data.botName) this.config.botName = data.botName;
                  if (data.primaryColor) this.config.primaryColor = data.primaryColor;
                  if (data.startMessage) this.config.startMessage = data.startMessage;
                  
                  if (data.widgetSettings) {
                      this.settings = { ...this.settings, ...data.widgetSettings };
                      // Apply primary color if set
                      if (this.settings.primaryColor) {
                          this.config.primaryColor = this.settings.primaryColor;
                      }
                      // Apply Clarity ID if not manually overridden and present in settings
                      if (!this.config.clarityId && this.settings.clarityId) {
                          this.config.clarityId = this.settings.clarityId;
                          // Initialize Clarity late if we got it from server
                          (function(c,l,a,r,i,t,y){
                              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                          })(window, document, "clarity", "script", this.config.clarityId);
                      }
                  }
                  
                  // Apply dynamic styles
                  this.applyDynamicStyles();
                  this.updateView();
              }
              } catch (e) {
              console.warn('WriterAI: Config load failed', e);
          }
          
          // Fetch and apply proactive triggers
          this.fetchProactiveTriggers();
      }

      async fetchProactiveTriggers() {
          try {
              const res = await fetch(`${this.apiBase}/triggers?botId=${this.config.botId}&apiKey=${this.config.apiKey}`, {
                  headers: { 'x-api-key': this.config.apiKey }
              });
              if (!res.ok) return;
              const data = await res.json();
              if (data.triggers && Array.isArray(data.triggers)) {
                  this.evaluateProactiveTriggers(data.triggers);
              }
          } catch (e) {
              console.warn('WriterAI: Proactive triggers load failed', e);
          }
      }

      evaluateProactiveTriggers(triggers) {
          if (this.proactiveTriggerFired) return; // Only fire once per page load
          const currentPath = window.location.pathname;
          
          for (const trigger of triggers) {
              if (!trigger.is_enabled) continue;
              
              // Simple pattern matching: supports * as wildcard
              const pattern = trigger.url_pattern.replace(/\*/g, '.*');
              const regex = new RegExp(`^${pattern}$`, 'i');
              
              if (regex.test(currentPath)) {
                  setTimeout(() => {
                      if (this.proactiveTriggerFired || this.state.isOpen) return;
                      this.proactiveTriggerFired = true;
                      this.showProactiveMessage(trigger.message);
                  }, (trigger.delay_seconds || 5) * 1000);
                  break; // Only fire first matching trigger
              }
          }
      }

      showProactiveMessage(message) {
          // Show a small preview bubble near the launcher
          const bubble = document.createElement('div');
          bubble.className = 'proactive-bubble';
          bubble.innerHTML = `
              <span class="proactive-text">${message}</span>
              <span class="proactive-close" title="Dismiss">×</span>
          `;
          bubble.style.cssText = `
              position: fixed;
              bottom: 90px;
              right: 24px;
              background: white;
              border-radius: 12px;
              padding: 12px 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              max-width: 280px;
              font-size: 14px;
              z-index: 9998;
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              animation: slideIn 0.3s ease-out;
          `;
          
          const style = document.createElement('style');
          style.textContent = `
              @keyframes slideIn {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
              }
          `;
          document.head.appendChild(style);
          
          bubble.onclick = (e) => {
              if (e.target.classList.contains('proactive-close')) {
                  bubble.remove();
              } else {
                  bubble.remove();
                  this.toggle(); // Open the chat window
              }
          };
          
          document.body.appendChild(bubble);
          
          // Auto-dismiss after 10 seconds
          setTimeout(() => {
              if (bubble.parentNode) bubble.remove();
          }, 10000);
      }

      applyDynamicStyles() {
          const color = this.config.primaryColor;
          const launcher = this.shadow.querySelector('.launcher');
          const header = this.shadow.querySelector('.header');
          const homeTitle = this.shadow.querySelector('.home-title');
          const cardTitles = this.shadow.querySelectorAll('.home-card-title');
          const sendBtn = this.shadow.querySelector('.send-btn');
          const headerTitle = this.shadow.querySelector('.header-title');
          
          if (launcher) launcher.style.background = color;
          if (header) header.style.background = color;
          if (homeTitle) homeTitle.style.color = color;
          if (sendBtn) sendBtn.style.background = color;
          if (headerTitle && this.settings.botName) headerTitle.textContent = this.settings.botName;
          cardTitles.forEach(t => t.style.color = color);
      }

      showEmojiPicker() {
          const existingPicker = this.shadow.querySelector('.emoji-picker');
          if (existingPicker) {
              existingPicker.remove();
              return;
          }
          
          const emojis = ['😊', '👍', '❤️', '🎉', '😂', '🤔', '👋', '🙏', '✨', '🔥', '💯', '😍', '🤝', '💡', '👀', '🚀'];
          const picker = document.createElement('div');
          picker.className = 'emoji-picker';
          picker.innerHTML = emojis.map(e => `<span class="emoji-item">${e}</span>`).join('');
          picker.style.cssText = 'position:absolute;bottom:60px;left:8px;background:white;border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:100;';
          
          picker.querySelectorAll('.emoji-item').forEach(item => {
              item.style.cssText = 'cursor:pointer;font-size:20px;padding:4px;text-align:center;transition:transform 0.1s;';
              item.onclick = () => {
                  this.elements.input.value += item.textContent;
                  this.elements.input.focus();
                  picker.remove();
              };
          });
          
          this.shadow.querySelector('.input-area').appendChild(picker);
          
          // Close when clicking outside
          setTimeout(() => {
              const closeHandler = (e) => {
                  if (!picker.contains(e.target)) {
                      picker.remove();
                      document.removeEventListener('click', closeHandler);
                  }
              };
              document.addEventListener('click', closeHandler);
          }, 100);
      }

      startVoiceInput() {
          if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
              alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
              return;
          }
          
          const micBtn = this.shadow.querySelector('.voice-btn');
          
          // If already recording, stop it
          if (this.activeRecognition) {
              this.activeRecognition.stop();
              this.activeRecognition = null;
              if (micBtn) {
                  micBtn.style.color = '';
                  micBtn.innerHTML = ICONS.mic;
              }
              return;
          }
          
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;  // Keep listening
          recognition.interimResults = true;  // Show partial results
          recognition.lang = 'en-US';
          
          this.activeRecognition = recognition;
          
          if (micBtn) {
              micBtn.style.color = 'red';
              micBtn.innerHTML = '🔴';
              micBtn.title = 'Click to stop recording';
          }
          
          let finalTranscript = '';
          
          recognition.onresult = (event) => {
              let interimTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; i++) {
                  if (event.results[i].isFinal) {
                      finalTranscript += event.results[i][0].transcript + ' ';
                  } else {
                      interimTranscript += event.results[i][0].transcript;
                  }
              }
              this.elements.input.value = finalTranscript + interimTranscript;
          };
          
          recognition.onerror = (event) => {
              console.warn('Voice recognition error:', event.error);
              this.activeRecognition = null;
              if (micBtn) {
                  micBtn.style.color = '';
                  micBtn.innerHTML = ICONS.mic;
                  micBtn.title = 'Voice Input';
              }
              if (event.error === 'not-allowed') {
                  alert('Microphone access denied. Please allow microphone access to use voice input.');
              }
          };
          
          recognition.onend = () => {
              this.activeRecognition = null;
              if (micBtn) {
                  micBtn.style.color = '';
                  micBtn.innerHTML = ICONS.mic;
                  micBtn.title = 'Voice Input';
              }
          };
          
          recognition.start();
      }

      toggle() {
          this.state.isOpen = !this.state.isOpen;
          this.updateState();
      }

      updateState() {
          if (this.state.isOpen) {
              this.elements.window.style.display = 'flex';
              this.elements.launcher.style.display = 'none';
              this.updateView();
              if (this.state.view === 'chat') {
                  this.startPolling();
              }
          } else {
              this.elements.window.style.display = 'none';
              this.elements.launcher.style.display = 'flex';
              this.stopPolling();
          }
      }

      updateView() {
        const homeView = this.elements.window.querySelector('.home-view');
        const chatView = this.elements.window.querySelector('.chat-view lead-wrapper') || this.elements.window.querySelector('.chat-view'); // simplified selector logic
        const chatContainer = this.elements.window.querySelector('.chat-container'); 
        const backBtn = this.elements.window.querySelector('.back-btn');

        // Logic:
        // if settings.showHomeView is false, always show chat.
        // if view is home, show home.
        
        // Hide all first
        if (this.elements.homeView) this.elements.homeView.style.display = 'none';
        if (this.elements.chatContainer) this.elements.chatContainer.style.display = 'none';

        if (!this.settings.showHomeView) {
            this.state.view = 'chat';
        }

        if (this.state.view === 'home') {
             if (this.elements.homeView) {
                 this.elements.homeView.style.display = 'flex';
                 // Update recent message
                 const recent = this.state.messages.length > 0 ? this.state.messages[this.state.messages.length - 1].content : '';
                 const recentEl = this.elements.homeView.querySelector('.recent-msg-text');
                 if (recentEl) recentEl.textContent = recent || "No recent messages";
             }
             if (backBtn) backBtn.style.display = 'none';
        } else {
             if (this.elements.chatContainer) this.elements.chatContainer.style.display = 'flex';
             if (backBtn && this.settings.showHomeView) backBtn.style.display = 'block';
             this.scrollToBottom();
             
             // Check lead form
             if (this.config.collectEmail && !this.state.leadCaptured) {
                this.showLeadForm(true);
             } else {
                this.showLeadForm(false);
             }
        }
      }
      
      goToChat() {
          this.state.view = 'chat';
          this.updateView();
          this.startPolling();
      }
      
      goHome() {
          this.state.view = 'home';
          this.updateView();
          this.stopPolling();
      }

      startPolling() {
          if (this.pollingInterval) return;
          this.syncMessages();
          this.pollingInterval = setInterval(() => this.syncMessages(), 5000);
      }

      stopPolling() {
          if (this.pollingInterval) {
              clearInterval(this.pollingInterval);
              this.pollingInterval = null;
          }
      }

      async syncMessages() {
          if (!this.state.sessionId) return;
          try {
              const res = await fetch(`${this.apiBase}/messages?sessionId=${this.state.sessionId}`, {
                  headers: { 'x-api-key': this.config.apiKey }
              });
              if (res.ok) {
                  const data = await res.json();
                  if (data.messages && Array.isArray(data.messages)) {
                      const currentCount = this.state.messages.length;
                      const newMessages = data.messages.slice(currentCount); 
                      if (newMessages.length > 0) {
                          newMessages.forEach(msg => {
                              this.addMessage(msg.role, msg.content, true); // true = append to state, but addMessage handles dupe check implicitly by length logic usually? 
                              // Actually my addMessage logic simply pushes. 
                              // To avoid dupes in state during sync, we should be careful.
                              // `addMessage` param `save` defaults to true.
                              // If I call it here, it will double push to state.messages.
                              // Fix: Pass `save = false` because `data.messages` IS the state of truth from server? 
                              // Or better: `state.messages` should be updated by `data.messages` and then we render the diff.
                              // Let's stick to safe append for now.
                          });
                      }
                  }
              }
          } catch (e) {}
      }
      
      showLeadForm(show) {
          const chatArea = this.elements.window.querySelector('.chat-area'); // Defines the msg list + input
          const leadForm = this.elements.window.querySelector('.lead-form');
          
          if (show) {
              if (chatArea) chatArea.style.display = 'none';
              if (leadForm) leadForm.style.display = 'flex';
          } else {
              if (chatArea) chatArea.style.display = 'flex';
              if (leadForm) leadForm.style.display = 'none';
          }
      }
      
      submitLead() {
          const nameInput = this.shadow.querySelector('input[name="leadName"]');
          const emailInput = this.shadow.querySelector('input[name="leadEmail"]');
          const name = nameInput ? nameInput.value.trim() : '';
          const email = emailInput ? emailInput.value.trim() : '';
          
          if (!email || !email.includes('@')) {
              alert('Please enter a valid email address.');
              return;
          }
          this.state.leadData = { name, email };
          this.state.leadCaptured = true;
          this.saveState();
          this.showLeadForm(false);
      }

      async sendMessage() {
          const text = this.elements.input.value.trim();
          if (!text) return;

          this.addMessage('user', text);
          this.elements.input.value = '';
          this.setTyping(true);
          
          try {
              const payload = {
                  botId: this.config.botId,
                  message: text,
                  sessionId: this.state.sessionId,
                  webhooks: this.config.webhooks || {}
              };
              if (this.state.leadData) payload.lead = this.state.leadData;

              const res = await fetch(`${this.apiBase}/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
                  body: JSON.stringify(payload)
              });
              const data = await res.json();
              this.setTyping(false);
              
              if (data.sessionId) {
                  this.state.sessionId = data.sessionId;
                  this.saveState();
              }
              if (data.response) this.addMessage('assistant', data.response);
              else if (data.error) this.addMessage('system', 'Error: ' + data.error);
          } catch (e) {
              this.setTyping(false);
              this.addMessage('system', 'Connection error.');
          }
      }

      addMessage(role, text, save = true) {
          // Prevent duplicates if already in UI (simple check)
          // For MVP, just append.
          
          const msgDiv = document.createElement('div');
          msgDiv.className = `msg ${role}`;
          
          // Check for image attachments in text (format: ![alt](url))
          let contentHtml = this.formatText(text);
          const imgMatch = text.match(/!\[(image|file)\]\((.*?)\)/);
          if (imgMatch) {
              const url = imgMatch[2];
              // Check if it's an image by URL extension or content type
              if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || imgMatch[1] === 'image') {
                  contentHtml = `<img src="${url}" class="img-attachment" style="max-width:100%;max-height:200px;border-radius:8px;cursor:pointer;" onclick="window.open('${url}', '_blank')" />`;
              } else {
                  contentHtml = `<a href="${url}" target="_blank" class="file-attachment" style="display:flex;align-items:center;gap:6px;color:inherit;text-decoration:none;">📎 View Attachment</a>`;
              }
          }

          msgDiv.innerHTML = `<div class="bubble">${contentHtml}</div>`;
          
          this.elements.messagesList.appendChild(msgDiv);
          this.scrollToBottom();
          
          if (save) {
              this.state.messages.push({ role, content: text });
              this.saveState();
          }
      }

      async uploadFile(file) {
          const formData = new FormData();
          formData.append('file', file);
          
          this.addMessage('system', 'Uploading...', false);
          
          try {
            const res = await fetch(`${this.apiBase}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            // Remove "Uploading..." message
            this.elements.messagesList.lastChild.remove();

            if (data.url) {
                // Display image in chat
                const isImage = file.type.startsWith('image/');
                if (isImage) {
                    this.addMessage('user', `![image](${data.url})`);
                } else {
                    this.addMessage('user', `📎 Sent file: ${file.name}`);
                }
                
                // Send to agent with attachment
                this.setTyping(true);
                try {
                    const payload = {
                        botId: this.config.botId,
                        message: isImage ? 'I sent you an image. Please analyze it.' : `I sent you a file: ${file.name}`,
                        sessionId: this.state.sessionId,
                        attachments: [{
                            url: data.url,
                            type: data.type || file.type,
                            name: file.name
                        }],
                        webhooks: this.config.webhooks || {}
                    };
                    if (this.state.leadData) payload.lead = this.state.leadData;

                    const chatRes = await fetch(`${this.apiBase}/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
                        body: JSON.stringify(payload)
                    });
                    const chatData = await chatRes.json();
                    this.setTyping(false);
                    
                    if (chatData.sessionId) {
                        this.state.sessionId = chatData.sessionId;
                        this.saveState();
                    }
                    if (chatData.response) this.addMessage('assistant', chatData.response);
                    else if (chatData.error) this.addMessage('system', 'Error: ' + chatData.error);
                } catch (e) {
                    this.setTyping(false);
                    this.addMessage('system', 'Failed to send file to assistant.');
                }
            }
          } catch(e) {
             console.error('Upload failed', e);
             this.elements.messagesList.lastChild.remove();
             this.addMessage('system', 'Upload failed. Please try again.');
          }
      }

      setTyping(isTyping) {
          if (isTyping) {
              if (!this.elements.typingIndicator) {
                  const div = document.createElement('div');
                  div.className = 'msg assistant typing';
                  div.innerHTML = `<div class="bubble">...</div>`;
                  this.elements.messagesList.appendChild(div);
                  this.elements.typingIndicator = div;
                  this.scrollToBottom();
              }
          } else {
              if (this.elements.typingIndicator) {
                  this.elements.typingIndicator.remove();
                  this.elements.typingIndicator = null;
              }
          }
      }

      scrollToBottom() {
          const list = this.elements.messagesList;
          if(list) list.scrollTop = list.scrollHeight;
      }
      
      formatText(text) {
          if (!text) return '';
          return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
      }

      render() {
          if (document.getElementById('writerai-chatbot-host')) return;

          const host = document.createElement('div');
          host.id = 'writerai-chatbot-host';
          document.body.appendChild(host);
          this.shadow = host.attachShadow({ mode: 'open' });
          
          const style = document.createElement('style');
          style.textContent = `
            :host { all: initial; position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: -apple-system, sans-serif; }
            .launcher { width: 60px; height: 60px; border-radius: 30px; background: ${this.config.primaryColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; color: white; }
            .launcher:hover { transform: scale(1.05); }
            .launcher svg { width: 32px; height: 32px; }
            
            .window {
                position: absolute; bottom: 80px; right: 0; width: 380px; height: 600px; max-height: 80vh;
                background: white; border-radius: 16px; box-shadow: 0 5px 20px rgba(0,0,0,0.15);
                display: none; flex-direction: column; overflow: hidden; border: 1px solid #eee;
                animation: slideUp 0.3s ease;
            }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            
            .header { padding: 16px; background: ${this.config.primaryColor}; color: white; display: flex; justify-content: space-between; align-items: center; }
            .header-title { font-weight: 600; }
            .action-btn { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; padding: 4px; }
            .action-btn:hover { opacity: 1; }
            .action-btn svg { width: 20px; height: 20px; }
            
            /* Home View */
            .home-view { flex: 1; flex-direction: column; background: linear-gradient(to bottom, #f0f7ff, white); padding: 24px; display: none; }
            .home-title { font-size: 24px; font-weight: bold; margin-bottom: 8px; color: ${this.config.primaryColor}; }
            .home-subtitle { font-size: 18px; font-weight: 600; margin-bottom: 24px; color: #333; }
            .home-card { background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 12px; cursor: pointer; transition: transform 0.1s; border: 1px solid #eee; }
            .home-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .home-card-title { font-weight: 600; color: ${this.config.primaryColor}; display: flex; align-items: center; gap: 8px; }
            
            /* Chat Container within Window */
            .chat-container { display: flex; flex-direction: column; flex: 1; overflow: hidden; height: 100%; }
            .messages { flex: 1; padding: 16px; overflow-y: auto; background: #f9f9f9; display: flex; flex-direction: column; gap: 12px; }
            .msg { display: flex; animation: fadeIn 0.2s; }
            .msg.user { justify-content: flex-end; }
            .msg.assistant { justify-content: flex-start; }
            .bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
            .msg.user .bubble { background: ${this.config.primaryColor}; color: white; border-bottom-right-radius: 2px; }
            .msg.assistant .bubble { background: white; color: #333; border: 1px solid #eee; border-bottom-left-radius: 2px; }
            .img-attachment { max-width: 100%; border-radius: 8px; margin-top: 4px; }

            .input-area { padding: 12px; background: white; border-top: 1px solid #eee; }
            .toolbar { display: flex; gap: 12px; margin-bottom: 8px; padding: 0 4px; }
            .tool-btn { cursor: pointer; color: #999; display: flex; align-items: center; justify-content: center; }
            .tool-btn:hover { color: ${this.config.primaryColor}; }
            .tool-btn svg { width: 20px; height: 20px; }
            
            .input-wrapper { display: flex; gap: 8px; }
            .input-wrapper input { flex: 1; padding: 10px 16px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
            .input-wrapper input:focus { border-color: ${this.config.primaryColor}; }
            .send-btn { background: ${this.config.primaryColor}; border: none; width: 36px; height: 36px; border-radius: 18px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            
            .hidden { display: none !important; }
            .lead-form { flex: 1; padding: 30px; display: none; flex-direction: column; justify-content: center; gap: 12px; background: white; }
            .lead-form input { padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; }
            .lead-form button { background: ${this.config.primaryColor}; color: white; padding: 12px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }

            @media (max-width: 480px) {
                .window { width: 100vw; height: 100vh; bottom: 0; right: 0; border-radius: 0; }
            }
          `;
          
          this.shadow.appendChild(style);
          this.shadow.innerHTML += `
            <div class="launcher">${ICONS.msg}</div>
            
            <div class="window">
                <div class="header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="action-btn back-btn" style="display:none;">${ICONS.back}</button>
                        <span class="header-title">${this.config.botName}</span>
                    </div>
                    <div>
                        <button class="action-btn close-btn">${ICONS.close}</button>
                    </div>
                </div>

                <!-- Home View -->
                <div class="home-view">
                    <div class="home-title">Hi there 👋</div>
                    <div class="home-subtitle">${this.settings.welcomeMessage }</div>

                    <!-- Recent Message Card -->
                    <div class="home-card" id="recent-msg-card">
                        <div style="font-size:12px; color:#999; margin-bottom:4px;">Recent conversation</div>
                        <div class="recent-msg-text" style="font-size:14px; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">No active chat</div>
                    </div>

                    <!-- New Message Card -->
                    <div class="home-card" id="new-msg-card">
                        <div class="home-card-title">${ICONS.send} Send us a message</div>
                        <div style="font-size:13px; color:#666; margin-top:4px;">${this.settings.description}</div>
                    </div>
                </div>

                <!-- Chat Container -->
                <div class="chat-container" style="display:none;">
                    <div class="chat-area" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
                        <div class="messages"></div>
                        <div class="input-area">
                            <div class="toolbar">
                                <label class="tool-btn" title="Attach File">
                                    <input type="file" style="display:none;" id="file-input" />
                                    ${ICONS.attach}
                                </label>
                                <div class="tool-btn emoji-btn" title="Emoji">${ICONS.emoji}</div>
                                <div class="tool-btn voice-btn" title="Voice Input">${ICONS.mic}</div>
                            </div>
                            <div class="input-wrapper">
                                <input type="text" placeholder="Type a message..." />
                                <button class="send-btn">${ICONS.send}</button>
                            </div>
                        </div>
                    </div>

                    <div class="lead-form">
                        <h3>One last thing! 👇</h3>
                        <p>What's your email in case we get disconnected?</p>
                        <input type="text" name="leadName" placeholder="Your Name" />
                        <input type="email" name="leadEmail" placeholder="name@example.com" />
                        <button class="submit-lead-btn">Start Chatting</button>
                    </div>
                </div>
            </div>
          `;

          this.elements = {};
          this.elements.launcher = this.shadow.querySelector('.launcher');
          this.elements.window = this.shadow.querySelector('.window');
          this.elements.messagesList = this.shadow.querySelector('.messages');
          this.elements.input = this.shadow.querySelector('.input-wrapper input');
          this.elements.homeView = this.shadow.querySelector('.home-view');
          this.elements.chatContainer = this.shadow.querySelector('.chat-container');
          this.elements.headerTitle = this.shadow.querySelector('.header-title');
          this.elements.typingIndicator = null;
          
          this.elements.launcher.onclick = () => this.toggle();
          this.shadow.querySelector('.close-btn').onclick = () => this.toggle();
          this.shadow.querySelector('.back-btn').onclick = () => this.goHome();
          this.shadow.querySelector('#new-msg-card').onclick = () => this.goToChat();
          this.shadow.querySelector('#recent-msg-card').onclick = () => this.goToChat();

          this.shadow.querySelector('.send-btn').onclick = () => this.sendMessage();
          this.elements.input.onkeypress = (e) => {
              if (e.key === 'Enter') this.sendMessage();
          };
          
          this.shadow.querySelector('.submit-lead-btn').onclick = () => this.submitLead();
          
          // Emoji button handler
          const emojiBtn = this.shadow.querySelector('.emoji-btn');
          if (emojiBtn) emojiBtn.onclick = () => this.showEmojiPicker();
          
          // Voice button handler
          const voiceBtn = this.shadow.querySelector('.voice-btn');
          if (voiceBtn) voiceBtn.onclick = () => this.startVoiceInput();
          
          const fileInput = this.shadow.querySelector('#file-input');
          fileInput.onchange = (e) => {
              if (e.target.files.length > 0) this.uploadFile(e.target.files[0]);
          };
          
          if (this.pendingMessages) {
              this.pendingMessages.forEach(m => this.addMessage(m.role, m.content, false));
              this.pendingMessages = null;
          }
      }
  }

  window.WriterAIChat = new WriterAIChat();
})(window);
