// POST /api/feedback - Klant geeft duim omhoog/omlaag op een antwoord
import { query } from '../../lib/db.js';
import { jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const { message_id, session_id, rating, comment } = JSON.parse(event.body || '{}');
    if (![1, -1].includes(rating)) {
      return jsonResponse(400, { error: 'Rating moet 1 of -1 zijn' });
    }
    await query(
      `INSERT INTO feedback (message_id, session_id, rating, comment) VALUES ($1, $2, $3, $4)`,
      [message_id || null, session_id || null, rating, comment || null]
    );
    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('feedback error:', err);
    return jsonResponse(500, { error: 'Fout bij opslaan feedback' });
  }
};
