// GET /api/admin-unmatched - Lijst van vragen waar de bot geen antwoord op wist
// Dit is HOE de bot slimmer wordt: admin leest deze vragen, voegt FAQ toe = bot leert
import { query } from '../../lib/db.js';
import { requireAuth, jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const user = requireAuth(event);
  if (!user) return jsonResponse(401, { error: 'Niet ingelogd' });

  try {
    // Haal alle user-berichten op waarvan het volgende bot-antwoord 'fallback' was
    // (of andere intents die aangeven dat de bot niet goed kon antwoorden)
    const { rows } = await query(`
      WITH pairs AS (
        SELECT
          u.id AS user_msg_id,
          u.session_id,
          u.content AS user_question,
          u.created_at AS asked_at,
          LEAD(a.content) OVER (PARTITION BY u.session_id ORDER BY u.created_at) AS bot_reply,
          LEAD(a.matched_intent) OVER (PARTITION BY u.session_id ORDER BY u.created_at) AS matched_intent
        FROM messages u
        LEFT JOIN messages a ON a.session_id = u.session_id
          AND a.role = 'assistant'
          AND a.created_at > u.created_at
        WHERE u.role = 'user'
          AND u.created_at > NOW() - INTERVAL '90 days'
      )
      SELECT DISTINCT ON (user_question)
        user_msg_id, session_id, user_question, asked_at, matched_intent
      FROM pairs
      WHERE matched_intent IN ('fallback', 'orderstatus_no_number', 'track_trace_no_number', 'product_search_no_term')
      ORDER BY user_question, asked_at DESC
      LIMIT 100
    `);

    return jsonResponse(200, { unmatched: rows });
  } catch (err) {
    console.error('admin-unmatched error:', err);
    return jsonResponse(500, { error: err.message });
  }
};
