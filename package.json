/**
 * Intersport Chatbot Widget v1.0
 * Eén JS-bestand dat alles regelt: UI, events, API calls.
 *
 * Installatie: voeg in Magento Admin > Content > Design > Configuration >
 * HTML Head > Scripts and Style Sheets deze regel toe:
 *
 *   <script src="https://JOUW-NETLIFY-SITE.netlify.app/widget/chatbot.js" async></script>
 *
 * Optioneel: configuratie via data-attributes:
 *   <script src="..." async
 *     data-api-url="https://JOUW-NETLIFY-SITE.netlify.app/api"
 *     data-color="#e30613"
 *     data-bot-name="Sporti"></script>
 */
(function () {
  'use strict';

  if (window.__INTERSPORT_CHATBOT_LOADED__) return;
  window.__INTERSPORT_CHATBOT_LOADED__ = true;

  // Config uit script tag of defaults
  const scriptTag = document.currentScript || document.querySelector('script[src*="chatbot.js"]');
  const apiBase = (scriptTag?.dataset?.apiUrl || scriptTag?.src?.replace(/\/widget\/chatbot\.js.*$/, '/api')) || '/api';
  const primaryColor = scriptTag?.dataset?.color || '#e30613';
  const botName = scriptTag?.dataset?.botName || 'Sporti';
  const welcome = scriptTag?.dataset?.welcome || `Hoi! Ik ben ${botName}, de AI-assistent van Intersport Roden. Waar kan ik je mee helpen?`;

  // Visitor ID (persistent per browser)
  function getVisitorId() {
    let id = localStorage.getItem('intersport_visitor_id');
    if (!id) {
      id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('intersport_visitor_id', id);
    }
    return id;
  }
  const visitorId = getVisitorId();
  let sessionId = null;

  // ===== STYLES =====
  const styles = `
    .isc-widget, .isc-widget * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .isc-bubble {
      position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;
      border-radius: 50%; background: ${primaryColor}; color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 999999; border: none; transition: transform 0.2s;
    }
    .isc-bubble:hover { transform: scale(1.05); }
    .isc-bubble svg { width: 28px; height: 28px; fill: #fff; }
    .isc-panel {
      position: fixed; bottom: 95px; right: 20px;
      width: 380px; height: 560px; max-height: calc(100vh - 120px); max-width: calc(100vw - 40px);
      background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: none; flex-direction: column; overflow: hidden;
      z-index: 999999; border: 1px solid #eee;
    }
    .isc-panel.open { display: flex; animation: iscSlideUp 0.2s ease-out; }
    @keyframes iscSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .isc-header {
      background: ${primaryColor}; color: #fff; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .isc-header-title { font-weight: 600; font-size: 15px; }
    .isc-header-sub { font-size: 11px; opacity: 0.9; }
    .isc-close { background: none; border: none; color: #fff; cursor: pointer; font-size: 22px; line-height: 1; padding: 0 4px; }
    .isc-messages { flex: 1; overflow-y: auto; padding: 14px; background: #f8f8f8; }
    .isc-msg { margin-bottom: 10px; display: flex; }
    .isc-msg.user { justify-content: flex-end; }
    .isc-msg-bubble {
      max-width: 80%; padding: 10px 14px; border-radius: 16px;
      font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;
    }
    .isc-msg.bot .isc-msg-bubble { background: #fff; color: #222; border: 1px solid #eee; border-bottom-left-radius: 4px; }
    .isc-msg.user .isc-msg-bubble { background: ${primaryColor}; color: #fff; border-bottom-right-radius: 4px; }
    .isc-msg-bubble a { color: inherit; text-decoration: underline; }
    .isc-feedback { display: flex; gap: 6px; margin-top: 4px; padding-left: 6px; }
    .isc-fb-btn { background: none; border: none; cursor: pointer; opacity: 0.4; font-size: 14px; padding: 2px 4px; }
    .isc-fb-btn:hover, .isc-fb-btn.active { opacity: 1; }
    .isc-typing { display: flex; gap: 4px; padding: 12px 14px; }
    .isc-typing span { width: 8px; height: 8px; background: #aaa; border-radius: 50%; animation: iscBlink 1.4s infinite; }
    .isc-typing span:nth-child(2) { animation-delay: 0.2s; }
    .isc-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes iscBlink { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
    .isc-input-row { display: flex; padding: 10px; border-top: 1px solid #eee; background: #fff; gap: 8px; }
    .isc-input {
      flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 20px;
      font-size: 14px; outline: none; font-family: inherit;
    }
    .isc-input:focus { border-color: ${primaryColor}; }
    .isc-send {
      background: ${primaryColor}; border: none; color: #fff; width: 40px; height: 40px;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .isc-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .isc-send svg { width: 18px; height: 18px; fill: #fff; }
    .isc-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px; background: #f8f8f8; border-top: 1px solid #eee; }
    .isc-quick-btn {
      background: #fff; border: 1px solid #ddd; border-radius: 16px;
      padding: 6px 12px; font-size: 12px; cursor: pointer; color: #333;
    }
    .isc-quick-btn:hover { background: ${primaryColor}; color: #fff; border-color: ${primaryColor}; }
    .isc-footer { text-align: center; font-size: 10px; color: #999; padding: 6px; background: #fff; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // ===== HTML =====
  const root = document.createElement('div');
  root.className = 'isc-widget';
  root.innerHTML = `
    <button class="isc-bubble" aria-label="Open chat">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 5.94 2 10.5c0 2.46 1.32 4.68 3.44 6.2L4 21l4.84-1.61c.98.27 2.03.41 3.16.41 5.52 0 10-3.94 10-8.5S17.52 2 12 2z"/></svg>
    </button>
    <div class="isc-panel" role="dialog" aria-label="Chat met ${botName}">
      <div class="isc-header">
        <div>
          <div class="isc-header-title">${botName}</div>
          <div class="isc-header-sub">Intersport Roden • Meestal binnen seconden antwoord</div>
        </div>
        <button class="isc-close" aria-label="Sluiten">×</button>
      </div>
      <div class="isc-messages" id="isc-messages"></div>
      <div class="isc-quick" id="isc-quick">
        <button class="isc-quick-btn" data-q="Waar blijft mijn bestelling?">📦 Waar blijft mijn bestelling?</button>
        <button class="isc-quick-btn" data-q="Hoe kan ik retourneren?">↩️ Retourneren</button>
        <button class="isc-quick-btn" data-q="Wat zijn de openingstijden?">🕒 Openingstijden</button>
        <button class="isc-quick-btn" data-q="Ik zoek productadvies">👟 Productadvies</button>
      </div>
      <div class="isc-input-row">
        <input class="isc-input" id="isc-input" type="text" placeholder="Typ je vraag..." maxlength="500" />
        <button class="isc-send" id="isc-send" aria-label="Verstuur">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="isc-footer">Powered by Claude AI</div>
    </div>
  `;
  document.body.appendChild(root);

  const bubble = root.querySelector('.isc-bubble');
  const panel = root.querySelector('.isc-panel');
  const closeBtn = root.querySelector('.isc-close');
  const messagesEl = root.querySelector('#isc-messages');
  const inputEl = root.querySelector('#isc-input');
  const sendBtn = root.querySelector('#isc-send');
  const quickEl = root.querySelector('#isc-quick');

  // ===== STATE =====
  let isOpen = false;
  let isSending = false;
  let hasWelcomed = false;

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function linkify(s) {
    return escapeHtml(s).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  function addMessage(role, text, messageId) {
    const div = document.createElement('div');
    div.className = `isc-msg ${role}`;
    const bubbleHtml = `<div class="isc-msg-bubble">${linkify(text)}</div>`;
    let fbHtml = '';
    if (role === 'bot' && messageId) {
      fbHtml = `
        <div class="isc-feedback" data-msg-id="${messageId}">
          <button class="isc-fb-btn" data-rating="1" aria-label="Goed antwoord">👍</button>
          <button class="isc-fb-btn" data-rating="-1" aria-label="Niet goed">👎</button>
        </div>`;
    }
    div.innerHTML = `<div>${bubbleHtml}${fbHtml}</div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (role === 'bot' && messageId) {
      div.querySelectorAll('.isc-fb-btn').forEach(btn => {
        btn.addEventListener('click', () => sendFeedback(messageId, parseInt(btn.dataset.rating, 10), btn));
      });
    }
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'isc-msg bot isc-typing-row';
    div.innerHTML = `<div class="isc-msg-bubble isc-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  async function sendFeedback(messageId, rating, btnEl) {
    try {
      await fetch(`${apiBase}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, session_id: sessionId, rating })
      });
      btnEl.classList.add('active');
      btnEl.parentNode.querySelectorAll('.isc-fb-btn').forEach(b => {
        if (b !== btnEl) b.style.display = 'none';
      });
    } catch (e) { console.warn('feedback error', e); }
  }

  async function sendMessage(text) {
    if (!text || isSending) return;
    isSending = true;
    sendBtn.disabled = true;
    addMessage('user', text);
    inputEl.value = '';
    quickEl.style.display = 'none';

    const typingEl = showTyping();

    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          visitor_id: visitorId,
          page_url: window.location.href,
        })
      });
      const data = await res.json();
      typingEl.remove();

      if (data.session_id) sessionId = data.session_id;
      if (data.reply) {
        addMessage('bot', data.reply, data.message_id);
      } else {
        addMessage('bot', data.error || 'Sorry, er ging iets mis. Probeer het opnieuw.');
      }
    } catch (err) {
      typingEl.remove();
      addMessage('bot', 'Ik kan op dit moment geen verbinding maken. Probeer het later opnieuw of bel ons.');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ===== EVENTS =====
  function openPanel() {
    panel.classList.add('open');
    isOpen = true;
    if (!hasWelcomed) {
      addMessage('bot', welcome);
      hasWelcomed = true;
    }
    inputEl.focus();
  }
  function closePanel() { panel.classList.remove('open'); isOpen = false; }

  bubble.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);
  sendBtn.addEventListener('click', () => sendMessage(inputEl.value.trim()));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value.trim());
    }
  });
  quickEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.isc-quick-btn');
    if (btn) sendMessage(btn.dataset.q);
  });

  // Publieke API
  window.IntersportChatbot = {
    open: openPanel,
    close: closePanel,
    ask: (text) => { openPanel(); sendMessage(text); }
  };
})();
