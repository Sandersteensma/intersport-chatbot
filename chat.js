// GET /api/admin-stats - Statistieken voor het dashboard
import { query } from '../../lib/db.js';
import { requireAuth, jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const user = requireAuth(event);
  if (!user) return jsonResponse(401, { error: 'Niet ingelogd' });

  try {
    // Totalen
    const totals = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM sessions WHERE started_at > NOW() - INTERVAL '30 days') AS sessions_30d,
        (SELECT COUNT(*)::int FROM messages WHERE created_at > NOW() - INTERVAL '30 days') AS messages_30d,
        (SELECT COUNT(DISTINCT visitor_id)::int FROM sessions WHERE started_at > NOW() - INTERVAL '30 days') AS unique_visitors_30d,
        (SELECT COUNT(*)::int FROM feedback WHERE rating = 1 AND created_at > NOW() - INTERVAL '30 days') AS positive_30d,
        (SELECT COUNT(*)::int FROM feedback WHERE rating = -1 AND created_at > NOW() - INTERVAL '30 days') AS negative_30d,
        (SELECT COUNT(*)::int FROM messages WHERE matched_intent = 'fallback' AND created_at > NOW() - INTERVAL '30 days') AS unmatched_30d,
        (SELECT COUNT(*)::int FROM messages WHERE role = 'assistant' AND matched_intent IS NOT NULL AND matched_intent <> 'fallback' AND created_at > NOW() - INTERVAL '30 days') AS matched_30d
    `);

    // Intent verdeling (welke antwoorden heeft de bot gegeven)
    const intents = await query(`
      SELECT matched_intent, COUNT(*)::int AS count
      FROM messages
      WHERE role = 'assistant'
        AND matched_intent IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY matched_intent
      ORDER BY count DESC
      LIMIT 20
    `);

    // Top FAQ's (hoe vaak gebruikt)
    const topFaqs = await query(`
      SELECT id, question, match_count
      FROM faq_entries
      WHERE active = true
      ORDER BY match_count DESC
      LIMIT 10
    `);

    // Top eerste vragen
    const topFirstMessages = await query(`
      SELECT SUBSTRING(content, 1, 80) AS preview, COUNT(*)::int AS count
      FROM messages m
      WHERE m.role = 'user'
        AND m.created_at > NOW() - INTERVAL '30 days'
        AND m.id IN (
          SELECT MIN(id) FROM messages WHERE role = 'user' GROUP BY session_id
        )
      GROUP BY preview
      ORDER BY count DESC
      LIMIT 10
    `);

    return jsonResponse(200, {
      totals: totals.rows[0],
      intents: intents.rows,
      top_faqs: topFaqs.rows,
      top_first_messages: topFirstMessages.rows,
    });
  } catch (err) {
    console.error('admin-stats error:', err);
    return jsonResponse(500, { error: err.message });
  }
};
