// GET /api/admin-conversations - Lijst met gesprekken voor admin dashboard
// GET /api/admin-conversations?session_id=xxx - Details van 1 gesprek
import { query } from '../../lib/db.js';
import { requireAuth, jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const user = requireAuth(event);
  if (!user) return jsonResponse(401, { error: 'Niet ingelogd' });

  try {
    const sessionId = event.queryStringParameters?.session_id;

    if (sessionId) {
      // Detail view: alle berichten van 1 sessie
      const { rows: session } = await query(
        `SELECT * FROM sessions WHERE id = $1`, [sessionId]
      );
      const { rows: messages } = await query(
        `SELECT m.*, f.rating AS feedback_rating
         FROM messages m
         LEFT JOIN feedback f ON f.message_id = m.id
         WHERE m.session_id = $1
         ORDER BY m.created_at ASC`,
        [sessionId]
      );
      return jsonResponse(200, { session: session[0] || null, messages });
    }

    // Lijst: recente sessies met statistieken
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    const { rows } = await query(
      `SELECT
         s.id,
         s.visitor_id,
         s.started_at,
         s.last_activity_at,
         s.page_url,
         COUNT(m.id) AS message_count,
         SUM(CASE WHEN f.rating = 1 THEN 1 ELSE 0 END) AS positive_feedback,
         SUM(CASE WHEN f.rating = -1 THEN 1 ELSE 0 END) AS negative_feedback,
         (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) AS first_message
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       LEFT JOIN feedback f ON f.session_id = s.id
       GROUP BY s.id
       ORDER BY s.last_activity_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: totals } = await query(
      `SELECT
         COUNT(DISTINCT s.id) AS total_sessions,
         COUNT(m.id) AS total_messages,
         COUNT(DISTINCT s.visitor_id) AS unique_visitors
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       WHERE s.started_at > NOW() - INTERVAL '30 days'`
    );

    return jsonResponse(200, {
      sessions: rows,
      stats: totals[0]
    });

  } catch (err) {
    console.error('admin-conversations error:', err);
    return jsonResponse(500, { error: 'Fout bij ophalen gesprekken' });
  }
};
