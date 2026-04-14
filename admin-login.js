// CRUD voor FAQ entries met keywords support
import { query } from '../../lib/db.js';
import { requireAuth, jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const user = requireAuth(event);
  if (!user) return jsonResponse(401, { error: 'Niet ingelogd' });

  const id = event.queryStringParameters?.id;

  try {
    if (event.httpMethod === 'GET') {
      const { rows } = await query(
        `SELECT * FROM faq_entries ORDER BY priority DESC, id ASC`
      );
      return jsonResponse(200, { faqs: rows });
    }

    if (event.httpMethod === 'POST') {
      const { question, answer, keywords, category, priority, active } = JSON.parse(event.body || '{}');
      if (!question || !answer) {
        return jsonResponse(400, { error: 'question en answer zijn verplicht' });
      }
      const kwArray = parseKeywords(keywords);
      const { rows } = await query(
        `INSERT INTO faq_entries (question, answer, keywords, category, priority, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [question, answer, kwArray, category || 'algemeen', priority || 5, active !== false]
      );
      return jsonResponse(200, { faq: rows[0] });
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return jsonResponse(400, { error: 'id ontbreekt' });
      const body = JSON.parse(event.body || '{}');
      const kwArray = body.keywords !== undefined ? parseKeywords(body.keywords) : null;
      const { rows } = await query(
        `UPDATE faq_entries
         SET question = COALESCE($2, question),
             answer = COALESCE($3, answer),
             keywords = COALESCE($4, keywords),
             category = COALESCE($5, category),
             priority = COALESCE($6, priority),
             active = COALESCE($7, active),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, body.question, body.answer, kwArray, body.category, body.priority, body.active]
      );
      return jsonResponse(200, { faq: rows[0] });
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return jsonResponse(400, { error: 'id ontbreekt' });
      await query(`DELETE FROM faq_entries WHERE id = $1`, [id]);
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('admin-faq error:', err);
    return jsonResponse(500, { error: err.message });
  }
};

// Keywords kunnen als array of comma-separated string komen
function parseKeywords(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  return String(input).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
