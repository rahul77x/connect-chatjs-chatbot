/**
 * Amazon Connect ChatJS Client Wrapper
 * 
 * Manages the Amazon Connect ChatSession lifecycle, WebSocket connections,
 * message streams, participant events, and fallback botanical simulation mode.
 */

class AmazonConnectChatClient {
  constructor(options = {}) {
    this.apiEndpoint = options.apiEndpoint || '/api/start-chat';
    this.region = options.region || 'us-east-1';
    this.session = null;
    this.contactId = null;
    this.participantId = null;
    this.participantToken = null;
    this.mode = 'idle'; // 'idle' | 'live-connect' | 'simulation'
    this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ENDED'
    this.eventListeners = {};
    this.customerName = options.customerName || 'Plant Lover';
    this.typingTimeout = null;

    // Simulated responses database for botanical nature theme
    this.simulationResponses = [
      {
        triggers: ['yellow', 'monstera', 'yellowing', 'leaves'],
        reply: `🌿 **Monstera Leaf Yellowing Diagnosis:**\n\n1. **Overwatering (Most Common):** Check the soil 2 inches down. If it's soggy, let it dry out completely before watering again.\n2. **Drainage:** Ensure the nursery pot has bottom drainage holes.\n3. **Lighting:** Monsteras love bright, indirect sunlight. Direct noon sun can scorch, while low light leads to root suffocation.\n\nWould you like a recommended watering schedule for your Monstera?`,
        quickReplies: ['💧 Watering schedule', '☀️ Ideal light levels', '🪴 Repotting advice']
      },
      {
        triggers: ['water', 'succulent', 'schedule', 'cacti', 'cactus'],
        reply: `💧 **Succulent & Cactus Hydration Guide:**\n\nSucculents follow the **"Soak & Dry"** method:\n- Water thoroughly until water drains from the bottom.\n- Wait until the soil is **100% dry** before watering again (typically every 2-3 weeks in summer, 4-6 weeks in winter).\n- Wrinkled, soft leaves indicate thirst; translucent, mushy leaves indicate overwatering.`,
        quickReplies: ['🪴 Best succulent soil', '☀️ Sunlight needs', '🌱 Propagate succulents']
      },
      {
        triggers: ['light', 'low light', 'dark', 'indoor plants', 'best plants'],
        reply: `🌱 **Top Low-Light Champion Plants for Indoor Spaces:**\n\n1. **ZZ Plant (*Zamioculcas zamiifolia*):** Nearly indestructible, tolerates dry spells and fluorescent lighting.\n2. **Snake Plant (*Sansevieria*):** Thrives on neglect and filters airborne toxins.\n3. **Cast Iron Plant (*Aspidistra elatior*):** Deep green foliage that perseveres in dim corners.\n4. **Pothos (*Epipremnum aureum*):** Fast-growing trailing vine adaptable to ambient rooms.`,
        quickReplies: ['🛒 Shop ZZ Plant', '🛒 Shop Snake Plant', '🪴 Care tips']
      },
      {
        triggers: ['pest', 'bugs', 'mites', 'gnats', 'mealybug', 'fungus'],
        reply: `🐛 **Natural Botanical Pest Control:**\n\n- **Fungus Gnats:** Let topsoil dry out, use yellow sticky traps, and bottom-water with diluted hydrogen peroxide.\n- **Spider Mites:** Wipe leaves with neem oil solution or insecticidal organic soap.\n- **Mealybugs:** Dab individual pests directly with a cotton swab dipped in 70% isopropyl alcohol.`,
        quickReplies: ['🌿 Organic Neem Spray', '🪲 Identify bug with photo', '👩‍🌾 Talk to Horticulturist']
      },
      {
        triggers: ['human', 'agent', 'horticulturist', 'person', 'support', 'specialist'],
        reply: `👩‍🌾 **Escalating to Human Horticulturist:**\n\nIn our live Amazon Connect setup, your chat is routed to the **Master Gardener Queue** in your contact center! Our on-call botanist will review your plant's profile and join this chat shortly.`,
        quickReplies: ['🕒 Check wait time', '📋 Send plant photo', '🏡 Book in-home repotting']
      }
    ];
  }

  /**
   * Event emitter pattern: subscribe to client events
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
    return this;
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event listener for "${event}":`, e);
        }
      });
    }
  }

  /**
   * Check whether Amazon Connect ChatJS library is loaded in window
   */
  isChatJsAvailable() {
    return typeof window.connect !== 'undefined' && typeof window.connect.ChatSession !== 'undefined';
  }

  /**
   * Step 1 (Control Plane): Call backend to initiate StartChatContact
   * Step 2 (Data Plane): Initialize amazon-connect-chatjs ChatSession
   */
  async startChat(customerName, initialMessage = null) {
    this.customerName = customerName || this.customerName;
    this.emit('statusChange', { status: 'CONNECTING', message: 'Initiating plant care consultation...' });

    try {
      // 1. Call Backend API to get ContactId & ParticipantToken
      console.log(`[ChatClient] Requesting session from backend: ${this.apiEndpoint}`);
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: this.customerName,
          initialMessage: initialMessage || undefined,
          attributes: {
            PlantInterest: 'Houseplants',
            ClientTime: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[ChatClient] Backend response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start chat session');
      }

      this.mode = result.mode; // 'live-connect' or 'simulation'
      this.region = result.region || this.region;
      this.contactId = result.data.contactId;
      this.participantId = result.data.participantId;
      this.participantToken = result.data.participantToken;

      // 2. Route based on mode
      if (this.mode === 'live-connect' && this.isChatJsAvailable()) {
        await this._initAmazonConnectSession(result.data);
      } else {
        await this._initSimulationSession(initialMessage);
      }

      return {
        mode: this.mode,
        contactId: this.contactId
      };
    } catch (error) {
      console.error('[ChatClient] Failed to start chat:', error);
      this.emit('statusChange', { status: 'ERROR', error: error.message });
      throw error;
    }
  }

  /**
   * Initialize official Amazon Connect ChatJS Session
   */
  async _initAmazonConnectSession(sessionData) {
    console.log('[ChatClient] Initializing Amazon Connect ChatSession with ChatJS...');

    try {
      // Configure global logger if needed
      if (window.connect.ChatSession.setGlobalConfig) {
        window.connect.ChatSession.setGlobalConfig({
          loggerConfig: {
            customizedLogger: {
              debug: (msg) => console.debug('[ConnectChatJS Debug]', msg),
              info: (msg) => console.log('[ConnectChatJS Info]', msg),
              warn: (msg) => console.warn('[ConnectChatJS Warn]', msg),
              error: (msg) => console.error('[ConnectChatJS Error]', msg)
            },
            level: window.connect.ChatSession.LogLevel.INFO
          }
        });
      }

      // Create Customer Chat Session
      this.session = window.connect.ChatSession.create({
        chatDetails: {
          contactId: sessionData.contactId,
          participantId: sessionData.participantId,
          participantToken: sessionData.participantToken
        },
        type: window.connect.ChatSession.SessionTypes.CUSTOMER,
        options: {
          region: this.region
        }
      });

      // Subscribe to ChatJS events
      this._bindChatJsEvents();

      // Connect WebSocket to Amazon Connect Participant Service
      console.log('[ChatClient] Connecting WebSocket via session.connect()...');
      await this.session.connect();

      this.status = 'CONNECTED';
      this.emit('statusChange', {
        status: 'CONNECTED',
        mode: 'live-connect',
        message: 'Connected to Amazon Connect Live Botanist Stream'
      });
    } catch (err) {
      console.error('[ChatClient] ChatJS session creation error:', err);
      // Fallback gracefully to simulation if network/auth rejected
      this.mode = 'simulation';
      await this._initSimulationSession();
    }
  }

  /**
   * Bind event handlers to Amazon Connect ChatJS session
   */
  _bindChatJsEvents() {
    if (!this.session) return;

    // 1. Incoming Message Event
    this.session.onMessage((event) => {
      console.log('[ChatClient] Incoming message event from ChatJS:', event);
      const data = event.data;

      // Filter out customer's own echoes if handled locally
      const isCustomer = data.ParticipantRole === 'CUSTOMER';
      const sender = isCustomer ? 'customer' : (data.DisplayName || 'Sprout (Amazon Connect)');

      // Extract content and type
      const contentType = data.ContentType;
      const text = data.Content || '';

      // Skip internal typing events handled separately
      if (contentType === 'application/vnd.amazonaws.connect.event.typing') {
        return;
      }

      // System participant events (joined, left)
      if (contentType.startsWith('application/vnd.amazonaws.connect.event.participant')) {
        this.emit('systemMessage', {
          text: `${data.DisplayName || 'Participant'} has ${contentType.includes('joined') ? 'joined' : 'left'} the chat.`,
          timestamp: data.AbsoluteTime || new Date().toISOString()
        });
        return;
      }

      // Regular text/markdown/interactive message
      this.emit('message', {
        id: data.Id || `msg-${Date.now()}`,
        sender: isCustomer ? 'customer' : 'bot',
        senderName: sender,
        text: text,
        contentType: contentType,
        timestamp: data.AbsoluteTime || new Date().toISOString(),
        raw: data
      });
    });

    // 2. Typing Indicator Event
    this.session.onTyping((event) => {
      console.log('[ChatClient] Typing event received:', event);
      if (event.data && event.data.ParticipantRole !== 'CUSTOMER') {
        this.emit('typing', {
          isTyping: true,
          participant: event.data.DisplayName || 'Sprout'
        });

        // Auto-clear typing indicator after 5 seconds if no follow-up
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
          this.emit('typing', { isTyping: false });
        }, 5000);
      }
    });

    // 3. Connection Established
    this.session.onConnectionEstablished(() => {
      console.log('[ChatClient] WebSocket connection established with Amazon Connect');
      this.status = 'CONNECTED';
      this.emit('statusChange', { status: 'CONNECTED', mode: 'live-connect' });
    });

    // 4. Connection Lost / Reconnecting
    this.session.onConnectionBroken(() => {
      console.warn('[ChatClient] WebSocket connection broken, attempting to reconnect...');
      this.emit('statusChange', { status: 'RECONNECTING' });
    });

    // 5. Chat Ended by Agent or System
    this.session.onEnded(() => {
      console.log('[ChatClient] Chat session ended');
      this.status = 'ENDED';
      this.emit('ended', { reason: 'Chat ended by participant or timeout' });
    });
  }

  /**
   * Botanical Simulation Engine (Used when no AWS credentials are wired yet)
   */
  async _initSimulationSession(initialMessage) {
    this.mode = 'simulation';
    this.status = 'CONNECTED';
    console.log('[ChatClient] Botanical Simulator initialized.');

    this.emit('statusChange', {
      status: 'CONNECTED',
      mode: 'simulation',
      message: 'Connected to Sprout (Botanical AI Simulation)'
    });

    // Send warm welcome message
    setTimeout(() => {
      this.emit('message', {
        id: 'welcome-bot',
        sender: 'bot',
        senderName: 'Sprout 🌱 Plant Expert',
        text: `Welcome to **Verdant & Wild**! 🌿 I am **Sprout**, your botanical guide.\n\nWhether your Monstera has yellowing leaves, you need a watering schedule for succulents, or you want help choosing low-light plants, I am here to help. What plant are we looking after today?`,
        quickReplies: [
          '🌱 Why are my leaves yellowing?',
          '💧 Succulent watering guide',
          '🌿 Best low-light indoor plants',
          '🐛 Natural pest remedies',
          '👩‍🌾 Connect with Live Botanist'
        ],
        timestamp: new Date().toISOString()
      });
    }, 400);

    if (initialMessage) {
      this.sendMessage(initialMessage);
    }
  }

  /**
   * Send a text message from the customer
   */
  async sendMessage(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // Optimistically render customer message locally
    const customerMsg = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      senderName: this.customerName,
      text: cleanText,
      timestamp: new Date().toISOString()
    };
    this.emit('message', customerMsg);

    // If connected to live Amazon Connect via ChatJS
    if (this.mode === 'live-connect' && this.session) {
      try {
        console.log('[ChatClient] Sending message to Amazon Connect:', cleanText);
        await this.session.sendMessage({
          contentType: 'text/plain',
          message: cleanText
        });
      } catch (err) {
        console.error('[ChatClient] Error sending message via ChatJS:', err);
        this.emit('error', { message: 'Failed to deliver message to Amazon Connect' });
      }
      return;
    }

    // Otherwise handle with Botanical Simulation Engine
    this._handleSimulatedResponse(cleanText);
  }

  /**
   * Generate intelligent botanical simulated response
   */
  _handleSimulatedResponse(userText) {
    const lower = userText.toLowerCase();

    // Trigger typing indicator
    this.emit('typing', { isTyping: true, participant: 'Sprout' });

    // Match response or generate intelligent general plant guidance
    let matched = this.simulationResponses.find(item =>
      item.triggers.some(trigger => lower.includes(trigger))
    );

    let replyText = '';
    let quickReplies = [];

    if (matched) {
      replyText = matched.reply;
      quickReplies = matched.quickReplies;
    } else {
      replyText = `🌿 **Botanical Note for "${userText}":**\n\nMost common houseplant issues trace back to the holy trinity of plant health:\n1. **Light:** Ensuring proper spectrum and intensity (avoid dark corners unless it's a ZZ or Snake plant).\n2. **Soil Aeration:** Using chunky, well-draining soil with perlite and orchid bark.\n3. **Water Consistency:** Watering thoroughly when the top 50% dry, rather than small frequent sips.\n\nCould you tell me the species of your plant or describe the leaves?`;
      quickReplies = ['🌱 Monstera Albo', '🌿 Fiddle Leaf Fig', '🪴 Succulent / Cactus', '👩‍🌾 Talk to Horticulturist'];
    }

    // Realistic typing delay (1.2 to 2 seconds)
    const delay = Math.min(2200, Math.max(1200, replyText.length * 5));
    setTimeout(() => {
      this.emit('typing', { isTyping: false });
      this.emit('message', {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        senderName: 'Sprout 🌱',
        text: replyText,
        quickReplies: quickReplies,
        timestamp: new Date().toISOString()
      });
    }, delay);
  }

  /**
   * Send Customer Typing Indicator
   */
  sendTypingEvent() {
    if (this.mode === 'live-connect' && this.session) {
      try {
        this.session.sendEvent({
          contentType: 'application/vnd.amazonaws.connect.event.typing'
        });
      } catch (err) {
        console.warn('[ChatClient] Unable to send typing event to ChatJS:', err);
      }
    }
  }

  /**
   * End Chat Session cleanly
   */
  async endChat() {
    console.log('[ChatClient] Disconnecting participant...');
    if (this.mode === 'live-connect' && this.session) {
      try {
        await this.session.disconnectParticipant();
      } catch (err) {
        console.warn('[ChatClient] Error disconnecting participant:', err);
      }
    }

    this.status = 'ENDED';
    this.emit('ended', { reason: 'User initiated disconnect' });
    this.emit('statusChange', { status: 'DISCONNECTED', message: 'Chat ended.' });
  }
}

// Attach to window
window.AmazonConnectChatClient = AmazonConnectChatClient;

