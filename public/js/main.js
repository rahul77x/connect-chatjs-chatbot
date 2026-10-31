/**
 * Verdant & Wild - Main Application Script
 * Initializes the Amazon Connect Chatbot and page interactive behaviors.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🌿 Verdant & Wild Botanical Sanctuary initializing...');

  // 1. Initialize Amazon Connect Chat Client
  const chatClient = new AmazonConnectChatClient({
    apiEndpoint: '/api/start-chat',
    customerName: 'Botanical Explorer'
  });

  // 2. Initialize UI Controller
  const chatUI = new BotanicaChatUI(chatClient);

  // 3. Connect page CTA buttons to the chatbot
  const askDoctorButtons = document.querySelectorAll('[data-ask-doctor]');
  askDoctorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const question = btn.getAttribute('data-ask-doctor');
      console.log('User triggered diagnostic question from card:', question);

      // Open widget if closed
      if (!chatUI.isOpen) {
        chatUI.openWidget();
      }

      // If already connected, send the question immediately
      if (chatClient.status === 'CONNECTED') {
        chatClient.sendMessage(question);
      } else {
        // Wait briefly for connection then send
        setTimeout(() => {
          chatClient.sendMessage(question);
        }, 600);
      }
    });
  });

  // 4. Hero "Start Consultation" CTA
  const heroConsultBtn = document.getElementById('hero-consult-btn');
  if (heroConsultBtn) {
    heroConsultBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chatUI.openWidget();
    });
  }

  // 5. Customer Name Change in Modal
  const saveNameBtn = document.getElementById('save-name-btn');
  const nameField = document.getElementById('customer-name-field');
  if (saveNameBtn && nameField) {
    saveNameBtn.addEventListener('click', () => {
      const newName = nameField.value.trim();
      if (newName) {
        chatClient.customerName = newName;
        alert(`Welcome, ${newName}! Your name is updated for the Amazon Connect session.`);
        const modal = document.getElementById('connect-config-modal');
        if (modal) modal.classList.remove('active');
      }
    });
  }

  // Log integration readiness
  console.log('✅ Amazon Connect ChatJS loaded:', chatClient.isChatJsAvailable());
});

