// POST /api/admin-learn - Een FAQ met keywords toevoegen (= bot leren)
import { query } from '../../lib/db.js';
import { requireAuth, jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const user = requireAuth(event);
  if (!user) return jsonResponse(401, { error: 'Niet ingelogd' });

  try {
    const { question, answer, keywords, category, priority } = JSON.parse(event.body || '{}');
    if (!question || !answer) {
      return jsonResponse(400, { error: 'question en answer zijn verplicht' });
    }

    let kwArray = [];
    if (Array.isArray(keywords)) {
      kwArray = keywords.map(s => String(s).trim().toLowerCase()).filter(Boolean);
    } else if (typeof keywords === 'string') {
      kwArray = keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }

    // Als er geen keywords zijn opgegeven: genereer automatisch uit de vraag
    if (kwArray.length === 0) {
      kwArray = autoKeywords(question);
    }

    const { rows } = await query(
      `INSERT INTO faq_entries (question, answer, keywords, category, priority, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [question, answer, kwArray, category || 'geleerd', priority || 5]
    );

    return jsonResponse(200, { ok: true, faq: rows[0] });
  } catch (err) {
    console.error('admin-learn error:', err);
    return jsonResponse(500, { error: err.message });
  }
};

// Automatisch keywords afleiden uit vraag (filtert stopwoorden)
const STOPWORDS = new Set([
  'ik','jij','u','je','een','de','het','van','voor','met','is','zijn','er',
  'nog','ook','wel','graag','welke','wat','die','dat','deze','zoek','heb',
  'hebben','hebt','kan','wil','mag','hoe','waar','wanneer','waarom',
  'mijn','jouw','uw','bij','aan','naar','in','op','om','te','om','of','en','maar'
]);

function autoKeywords(question) {
  return question
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8);
}
