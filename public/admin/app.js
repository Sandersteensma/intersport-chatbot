// Admin dashboard logic (rule-based versie)
const API = '/api';

// ===== AUTH =====
function getToken() { return localStorage.getItem('chatbot_admin_token'); }
function setToken(t) { localStorage.setItem('chatbot_admin_token', t); }
function clearToken() { localStorage.removeItem('chatbot_admin_token'); }

async function apiCall(path, opts = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error('Niet ingelogd');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API fout');
  return data;
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('appScreen').style.display = 'none';
}
function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  loadDashboard();
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const res = await fetch(API + '/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login mislukt');
    setToken(data.token);
    showApp();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

function doLogout() { clearToken(); showLogin(); }

document.getElementById('loginPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

// ===== TABS =====
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'conversations') loadConversations();
    if (btn.dataset.tab === 'unmatched') loadUnmatched();
    if (btn.dataset.tab === 'faq') loadFaqs();
  });
});

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const data = await apiCall('/admin-stats');
    const t = data.totals;
    const satisfaction = (t.positive_30d + t.negative_30d) > 0
      ? Math.round(100 * t.positive_30d / (t.positive_30d + t.negative_30d))
      : null;
    const matchRate = (t.matched_30d + t.unmatched_30d) > 0
      ? Math.round(100 * t.matched_30d / (t.matched_30d + t.unmatched_30d))
      : null;

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-label">Gesprekken 30d</div><div class="stat-value">${t.sessions_30d}</div></div>
      <div class="stat-card"><div class="stat-label">Berichten 30d</div><div class="stat-value">${t.messages_30d}</div></div>
      <div class="stat-card"><div class="stat-label">Unieke bezoekers</div><div class="stat-value">${t.unique_visitors_30d}</div></div>
      <div class="stat-card"><div class="stat-label">Match-rate</div><div class="stat-value">${matchRate !== null ? matchRate + '%' : '—'}</div></div>
      <div class="stat-card"><div class="stat-label">❓ Onbeantwoord</div><div class="stat-value" style="color:#e30613;">${t.unmatched_30d}</div></div>
      <div class="stat-card"><div class="stat-label">👍 Positief</div><div class="stat-value" style="color:#1a7f37;">${t.positive_30d}</div></div>
      <div class="stat-card"><div class="stat-label">👎 Negatief</div><div class="stat-value" style="color:#d93025;">${t.negative_30d}</div></div>
      <div class="stat-card"><div class="stat-label">Tevredenheid</div><div class="stat-value">${satisfaction !== null ? satisfaction + '%' : '—'}</div></div>
    `;

    const topTbody = document.querySelector('#topQuestionsTable tbody');
    if (data.top_first_messages.length === 0) {
      topTbody.innerHTML = '<tr><td>Nog geen gesprekken</td></tr>';
    } else {
      const max = Math.max(...data.top_first_messages.map(r => r.count));
      topTbody.innerHTML = data.top_first_messages.map(r => `
        <tr>
          <td style="width:70%;">${escapeHtml(r.preview)}</td>
          <td style="width:10%;font-weight:600;">${r.count}x</td>
          <td style="width:20%;"><div class="bar"><div class="bar-fill" style="width:${(r.count / max * 100).toFixed(0)}%;"></div></div></td>
        </tr>
      `).join('');
    }

    const intentTbody = document.querySelector('#intentsTable tbody');
    if (data.intents.length === 0) {
      intentTbody.innerHTML = '<tr><td>Nog geen data</td></tr>';
    } else {
      intentTbody.innerHTML = '<tr><th>Intent / Antwoordtype</th><th>Aantal</th></tr>' +
        data.intents.map(r => `<tr><td>${escapeHtml(r.matched_intent)}</td><td>${r.count}x</td></tr>`).join('');
    }

    const faqTbody = document.querySelector('#topFaqsTable tbody');
    if (data.top_faqs.length === 0 || data.top_faqs.every(f => f.match_count === 0)) {
      faqTbody.innerHTML = '<tr><td>Nog geen FAQ match data</td></tr>';
    } else {
      faqTbody.innerHTML = '<tr><th>Vraag</th><th>Gebruikt</th></tr>' +
        data.top_faqs.map(r => `<tr><td>${escapeHtml(r.question.slice(0,70))}</td><td>${r.match_count}x</td></tr>`).join('');
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== CONVERSATIONS =====
async function loadConversations() {
  try {
    const data = await apiCall('/admin-conversations');
    const tbody = document.querySelector('#conversationsTable tbody');
    if (data.sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Nog geen gesprekken</td></tr>';
      return;
    }
    tbody.innerHTML = data.sessions.map(s => `
      <tr onclick="openConversation('${s.id}')">
        <td>${formatDate(s.started_at)}</td>
        <td>${escapeHtml((s.first_message || '—').slice(0, 60))}</td>
        <td>${s.message_count}</td>
        <td>
          ${s.positive_feedback > 0 ? `<span class="feedback-pos">👍 ${s.positive_feedback}</span> ` : ''}
          ${s.negative_feedback > 0 ? `<span class="feedback-neg">👎 ${s.negative_feedback}</span>` : ''}
          ${s.positive_feedback == 0 && s.negative_feedback == 0 ? '—' : ''}
        </td>
        <td style="font-size:11px;color:#888;">${s.page_url ? escapeHtml(s.page_url.slice(0, 40)) : '—'}</td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

async function openConversation(sessionId) {
  document.getElementById('conversationModal').classList.add('open');
  document.getElementById('conversationDetail').innerHTML = 'Laden...';
  try {
    const data = await apiCall('/admin-conversations?session_id=' + sessionId);
    let html = `<div style="font-size:12px;color:#888;margin-bottom:12px;">Sessie: ${sessionId.slice(0, 8)}... • ${data.messages.length} berichten</div>`;

    let lastUserMsg = null;
    data.messages.forEach(m => {
      const date = formatDate(m.created_at);
      const rating = m.feedback_rating == 1 ? '👍' : m.feedback_rating == -1 ? '👎' : '';
      const intentBadge = m.matched_intent ? `<span class="tag" style="font-size:10px;">${escapeHtml(m.matched_intent)}</span>` : '';
      html += `<div class="msg msg-${m.role === 'user' ? 'user' : 'bot'}">
        <div class="msg-meta">${m.role === 'user' ? '👤 Klant' : '🤖 Bot'} — ${date} ${rating} ${intentBadge}</div>
        ${escapeHtml(m.content)}
      </div>`;
      if (m.role === 'user') {
        lastUserMsg = m;
      } else if (m.role === 'assistant' && lastUserMsg) {
        const needsLearning = m.matched_intent === 'fallback';
        html += `<div style="text-align:right;margin-bottom:10px;">
          <button class="btn ${needsLearning ? '' : 'btn-secondary'}" style="font-size:12px;padding:4px 10px;"
            onclick='learnFromConversation(${JSON.stringify(lastUserMsg.content)}, ${JSON.stringify(m.content)}, "${sessionId}")'>
            📚 ${needsLearning ? 'Beantwoord deze vraag' : 'Leer dit aan de bot'}
          </button>
        </div>`;
      }
    });
    document.getElementById('conversationDetail').innerHTML = html;
  } catch (e) {
    document.getElementById('conversationDetail').innerHTML = 'Fout: ' + e.message;
  }
}

// ===== UNMATCHED =====
async function loadUnmatched() {
  try {
    const data = await apiCall('/admin-unmatched');
    const tbody = document.querySelector('#unmatchedTable tbody');
    if (data.unmatched.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">🎉 Geen ongematchte vragen! De bot kon alles beantwoorden.</td></tr>';
      return;
    }
    const reasonLabel = {
      'fallback': 'Geen FAQ/intent match',
      'orderstatus_no_number': 'Vroeg naar bestelling zonder ordernummer',
      'track_trace_no_number': 'Vroeg naar tracking zonder ordernummer',
      'product_search_no_term': 'Productvraag zonder duidelijke term',
    };
    tbody.innerHTML = data.unmatched.map(u => `
      <tr>
        <td>${escapeHtml(u.user_question.slice(0, 100))}</td>
        <td style="font-size:11px;">${formatDate(u.asked_at)}</td>
        <td><span class="tag">${escapeHtml(reasonLabel[u.matched_intent] || u.matched_intent)}</span></td>
        <td><button class="btn" style="font-size:12px;padding:4px 10px;"
          onclick='answerUnmatched(${JSON.stringify(u.user_question)}, "${u.session_id}")'>
          + Beantwoorden
        </button></td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

function answerUnmatched(question, sessionId) {
  document.getElementById('learnQuestion').value = question;
  document.getElementById('learnAnswer').value = '';
  document.getElementById('learnKeywords').value = '';
  document.getElementById('learnSessionId').value = sessionId;
  document.getElementById('learnModal').classList.add('open');
}

function learnFromConversation(question, answer, sessionId) {
  document.getElementById('learnQuestion').value = question;
  document.getElementById('learnAnswer').value = answer;
  document.getElementById('learnKeywords').value = '';
  document.getElementById('learnSessionId').value = sessionId;
  closeModal('conversationModal');
  document.getElementById('learnModal').classList.add('open');
}

async function saveLearned() {
  try {
    await apiCall('/admin-learn', {
      method: 'POST',
      body: JSON.stringify({
        question: document.getElementById('learnQuestion').value,
        answer: document.getElementById('learnAnswer').value,
        keywords: document.getElementById('learnKeywords').value,
        category: document.getElementById('learnCategory').value,
        priority: 5,
      }),
    });
    closeModal('learnModal');
    alert('✅ Toegevoegd aan FAQ! De bot gebruikt dit vanaf nu voor soortgelijke vragen.');
    loadFaqs();
    loadUnmatched();
  } catch (e) {
    alert('Fout: ' + e.message);
  }
}

// ===== FAQ =====
async function loadFaqs() {
  try {
    const data = await apiCall('/admin-faq');
    const tbody = document.querySelector('#faqTable tbody');
    if (data.faqs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Nog geen FAQ entries</td></tr>';
      return;
    }
    tbody.innerHTML = data.faqs.map(f => `
      <tr onclick='editFaq(${JSON.stringify(f).replace(/'/g, "&apos;")})'>
        <td>${escapeHtml(f.question.slice(0, 80))}</td>
        <td><span class="tag">${escapeHtml(f.category)}</span></td>
        <td>${f.priority}</td>
        <td><span class="tag ${f.active ? 'tag-active' : 'tag-inactive'}">${f.active ? 'Actief' : 'Uit'}</span></td>
        <td><button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;">Bewerken</button></td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

function openFaqModal() {
  document.getElementById('faqModalTitle').textContent = 'Nieuwe FAQ toevoegen';
  document.getElementById('faqId').value = '';
  document.getElementById('faqQuestion').value = '';
  document.getElementById('faqAnswer').value = '';
  document.getElementById('faqKeywords').value = '';
  document.getElementById('faqCategory').value = 'algemeen';
  document.getElementById('faqPriority').value = 5;
  document.getElementById('faqActive').checked = true;
  document.getElementById('faqDeleteBtn').style.display = 'none';
  document.getElementById('faqModal').classList.add('open');
}

function editFaq(faq) {
  document.getElementById('faqModalTitle').textContent = 'FAQ bewerken';
  document.getElementById('faqId').value = faq.id;
  document.getElementById('faqQuestion').value = faq.question;
  document.getElementById('faqAnswer').value = faq.answer;
  document.getElementById('faqKeywords').value = (faq.keywords || []).join(', ');
  document.getElementById('faqCategory').value = faq.category;
  document.getElementById('faqPriority').value = faq.priority;
  document.getElementById('faqActive').checked = faq.active;
  document.getElementById('faqDeleteBtn').style.display = 'inline-block';
  document.getElementById('faqModal').classList.add('open');
}

async function saveFaq() {
  const id = document.getElementById('faqId').value;
  const body = {
    question: document.getElementById('faqQuestion').value,
    answer: document.getElementById('faqAnswer').value,
    keywords: document.getElementById('faqKeywords').value,
    category: document.getElementById('faqCategory').value,
    priority: parseInt(document.getElementById('faqPriority').value, 10),
    active: document.getElementById('faqActive').checked,
  };
  if (!body.question || !body.answer) {
    alert('Vraag en antwoord zijn verplicht');
    return;
  }
  try {
    if (id) {
      await apiCall('/admin-faq?id=' + id, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiCall('/admin-faq', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal('faqModal');
    loadFaqs();
  } catch (e) { alert('Fout: ' + e.message); }
}

async function deleteFaq() {
  const id = document.getElementById('faqId').value;
  if (!id || !confirm('Weet je zeker dat je deze FAQ wilt verwijderen?')) return;
  try {
    await apiCall('/admin-faq?id=' + id, { method: 'DELETE' });
    closeModal('faqModal');
    loadFaqs();
  } catch (e) { alert('Fout: ' + e.message); }
}

// ===== HELPERS =====
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// Start
if (getToken()) showApp();
else showLogin();
