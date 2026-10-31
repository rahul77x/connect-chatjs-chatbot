/**
 * Chat Widget UI Controller
 * 
 * Coordinates the DOM elements, rendering, typing effects, quick action chips,
 * and user interactions for the botanical plant chatbot widget.
 */

class BotanicaChatUI {
  constructor(chatClient) {
    this.client = chatClient;
    this.isOpen = false;
    this.isMinimized = false;
    this.unreadCount = 0;

    // DOM Elements cache
    this.launcher = document.getElementById('chat-launcher');
    this.launcherBadge = document.getElementById('launcher-badge');
    this.widget = document.getElementById('chat-widget');
    this.messageList = document.getElementById('chat-messages');
    this.inputField = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.closeBtn = document.getElementById('chat-close-btn');
    this.minimizeBtn = document.getElementById('chat-minimize-btn');
    this.resetBtn = document.getElementById('chat-reset-btn');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.statusBadge = document.getElementById('chat-status-badge');
    this.quickRepliesContainer = document.getElementById('chat-quick-replies');
    this.configModal = document.getElementById('connect-config-modal');
    this.openConfigBtn = document.getElementById('open-config-btn');
    this.closeConfigBtn = document.getElementById('close-config-btn');

    this.init();
  }

  init() {
    this.bindDOMEvents();
    this.bindClientEvents();
    this.checkConfigStatus();
  }

  /**
   * Bind event listeners to DOM interactions
   */
  bindDOMEvents() {
    // 1. Launcher click
    this.launcher.addEventListener('click', () => {
      this.toggleWidget();
    });

    // 2. Minimize & Close
    this.minimizeBtn.addEventListener('click', () => {
      this.minimizeWidget();
    });

    this.closeBtn.addEventListener('click', () => {
      this.closeWidget();
    });

    // 3. Reset chat
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        if (confirm('Start a fresh plant consultation session?')) {
          this.resetChat();
        }
      });
    }

    // 4. Send Message handlers
    this.sendBtn.addEventListener('click', () => {
      this.handleUserSend();
    });

    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSend();
      } else {
        // Send typing indicator to Connect
        this.client.sendTypingEvent();
      }
    });

    // 5. Config Modal
    if (this.openConfigBtn) {
      this.openConfigBtn.addEventListener('click', () => {
        this.configModal.classList.add('active');
      });
    }

    if (this.closeConfigBtn) {
      this.closeConfigBtn.addEventListener('click', () => {
        this.configModal.classList.remove('active');
      });
    }
  }

  /**
   * Bind event listeners to ChatClient events
   */
  bindClientEvents() {
    // Incoming Message
    this.client.on('message', (msg) => {
      this.renderMessage(msg);
      if (!this.isOpen) {
        this.unreadCount++;
        this.updateBadge();
      }
    });

    // System event
    this.client.on('systemMessage', (sys) => {
      this.renderSystemNotice(sys.text);
    });

    // Typing Event
    this.client.on('typing', (data) => {
      if (data.isTyping) {
        this.showTyping(data.participant || 'Sprout');
      } else {
        this.hideTyping();
      }
    });

    // Status Change
    this.client.on('statusChange', (data) => {
      this.updateStatusBadge(data);
    });

    // Chat Ended
    this.client.on('ended', () => {
      this.renderSystemNotice('The chat session has ended. Thank you for visiting Verdant & Wild! 🌿');
      this.updateStatusBadge({ status: 'ENDED', message: 'Chat Ended' });
    });
  }

  /**
   * Fetch backend config status to show current Amazon Connect integration status
   */
  async checkConfigStatus() {
    try {
      const res = await fetch('/api/config-status');
      if (res.ok) {
        const config = await res.json();
        const infoEl = document.getElementById('config-details-info');
        if (infoEl) {
          infoEl.innerHTML = `
            <div class="config-row"><strong>Integration Mode:</strong> <span class="badge ${config.configured ? 'live' : 'sim'}">${config.mode.toUpperCase()}</span></div>
            <div class="config-row"><strong>AWS Region:</strong> <code>${config.region}</code></div>
            <div class="config-row"><strong>Connect Instance:</strong> <code>${config.instanceIdMasked || 'Not set in .env (Using Simulator)'}</code></div>
            <div class="config-row"><strong>Contact Flow:</strong> <code>${config.contactFlowIdMasked || 'Not set in .env'}</code></div>
          `;
        }
      }
    } catch (e) {
      console.warn('Unable to query config status:', e);
    }
  }

  /**
   * Open / close toggle for chat widget
   */
  toggleWidget() {
    if (this.isOpen) {
      this.closeWidget();
    } else {
      this.openWidget();
    }
  }

  openWidget() {
    this.isOpen = true;
    this.isMinimized = false;
    this.widget.classList.add('active');
    this.widget.classList.remove('minimized');
    this.launcher.classList.add('active');
    this.unreadCount = 0;
    this.updateBadge();

    // Start session if not started yet
    if (this.client.status === 'DISCONNECTED') {
      const customerNameInput = document.getElementById('customer-name-field');
      const name = customerNameInput ? customerNameInput.value.trim() : 'Plant Friend';
      this.client.startChat(name);
    }

    setTimeout(() => {
      this.inputField.focus();
      this.scrollToBottom();
    }, 200);
  }

  closeWidget() {
    this.isOpen = false;
    this.widget.classList.remove('active');
    this.launcher.classList.remove('active');
  }

  minimizeWidget() {
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.widget.classList.add('minimized');
    } else {
      this.widget.classList.remove('minimized');
      this.scrollToBottom();
    }
  }

  resetChat() {
    this.messageList.innerHTML = '';
    this.quickRepliesContainer.innerHTML = '';
    this.client.endChat();
    setTimeout(() => {
      this.client.startChat('Plant Friend');
    }, 300);
  }

  updateBadge() {
    if (this.unreadCount > 0) {
      this.launcherBadge.textContent = this.unreadCount;
      this.launcherBadge.style.display = 'flex';
    } else {
      this.launcherBadge.style.display = 'none';
    }
  }

  handleUserSend() {
    const text = this.inputField.value.trim();
    if (!text) return;

    this.client.sendMessage(text);
    this.inputField.value = '';
    this.clearQuickReplies();
    this.inputField.focus();
  }

  /**
   * Render customer or bot message bubble
   */
  renderMessage(msg) {
    const isCustomer = msg.sender === 'customer';
    const row = document.createElement('div');
    row.className = `message-row ${isCustomer ? 'customer-row' : 'bot-row'}`;

    const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const parsedContent = this.parseMarkdown(msg.text || '');

    row.innerHTML = `
      ${!isCustomer ? `
        <div class="message-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
          </svg>
        </div>
      ` : ''}
      <div class="message-bubble-wrapper">
        <div class="message-sender">${isCustomer ? 'You' : (msg.senderName || 'Sprout')}</div>
        <div class="message-bubble ${isCustomer ? 'customer-bubble' : 'bot-bubble'}">
          ${parsedContent}
        </div>
        <div class="message-meta">
          <span class="message-time">${formattedTime}</span>
          ${isCustomer ? '<span class="message-status">✓ Sent</span>' : ''}
        </div>
      </div>
    `;

    this.messageList.appendChild(row);
    this.scrollToBottom();

    // Render quick action pills if provided
    if (msg.quickReplies && msg.quickReplies.length > 0) {
      this.renderQuickReplies(msg.quickReplies);
    }
  }

  renderSystemNotice(text) {
    const notice = document.createElement('div');
    notice.className = 'system-notice';
    notice.innerHTML = `<span>🌿 ${text}</span>`;
    this.messageList.appendChild(notice);
    this.scrollToBottom();
  }

  renderQuickReplies(replies) {
    this.quickRepliesContainer.innerHTML = '';
    replies.forEach(reply => {
      const chip = document.createElement('button');
      chip.className = 'quick-reply-chip';
      chip.textContent = reply;
      chip.addEventListener('click', () => {
        this.client.sendMessage(reply);
        this.clearQuickReplies();
      });
      this.quickRepliesContainer.appendChild(chip);
    });
    this.scrollToBottom();
  }

  clearQuickReplies() {
    this.quickRepliesContainer.innerHTML = '';
  }

  showTyping(participant) {
    this.typingIndicator.style.display = 'flex';
    const label = document.getElementById('typing-participant-label');
    if (label) label.textContent = `${participant} is typing...`;
    this.scrollToBottom();
  }

  hideTyping() {
    this.typingIndicator.style.display = 'none';
  }

  updateStatusBadge(data) {
    if (!this.statusBadge) return;
    const dot = this.statusBadge.querySelector('.status-dot');
    const label = this.statusBadge.querySelector('.status-label');

    if (data.status === 'CONNECTED') {
      dot.className = 'status-dot online';
      label.textContent = data.mode === 'live-connect' ? 'Live Connect' : 'Botanical AI Active';
      this.statusBadge.title = data.mode === 'live-connect' ? 'Connected to Amazon Connect Participant Service' : 'Running on Built-in Plant Care Intelligence';
    } else if (data.status === 'CONNECTING') {
      dot.className = 'status-dot connecting';
      label.textContent = 'Connecting...';
    } else if (data.status === 'ENDED' || data.status === 'DISCONNECTED') {
      dot.className = 'status-dot offline';
      label.textContent = 'Disconnected';
    }
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    });
  }

  /**
   * Lightweight markdown formatter for chat bubbles
   */
  parseMarkdown(text) {
    if (!text) return '';
    let parsed = text
      // Escape basic HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italics *text*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks `code`
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Line breaks
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n/g, '<br/>');

    return parsed;
  }
}

window.BotanicaChatUI = BotanicaChatUI;

