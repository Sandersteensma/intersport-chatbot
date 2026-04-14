// Gedeelde database connection pool voor alle Netlify Functions
import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3, // Netlify Functions zijn stateless, klein pool is prima
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

// Helper: haal actieve FAQ's op (gesorteerd op prioriteit)
export async function getActiveFaqs(limit = 50) {
  const { rows } = await query(
    `SELECT id, question, answer, category, keywords
     FROM faq_entries
     WHERE active = true
     ORDER BY priority DESC, id ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// Helper: maak of hergebruik sessie
export async function ensureSession(visitorId, pageUrl, userAgent) {
  // Hergebruik bestaande sessie als er recent activiteit was (< 30 min)
  const existing = await query(
    `SELECT id FROM sessions
     WHERE visitor_id = $1
       AND last_activity_at > NOW() - INTERVAL '30 minutes'
     ORDER BY last_activity_at DESC
     LIMIT 1`,
    [visitorId]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE sessions SET last_activity_at = NOW() WHERE id = $1`,
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const { rows } = await query(
    `INSERT INTO sessions (visitor_id, page_url, user_agent)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [visitorId, pageUrl || null, userAgent || null]
  );
  return rows[0].id;
}

// Helper: recente berichten in sessie (voor conversatie-context)
export async function getRecentMessages(sessionId, limit = 20) {
  const { rows } = await query(
    `SELECT role, content, created_at
     FROM messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  return rows.reverse(); // oudste eerst voor Claude
}

export async function saveMessage(sessionId, role, content, matchedIntent = null, matchedFaqId = null) {
  const { rows } = await query(
    `INSERT INTO messages (session_id, role, content, matched_intent, matched_faq_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [sessionId, role, content, matchedIntent, matchedFaqId]
  );
  return rows[0].id;
}

export async function logToolUsage(sessionId, toolName, input, output, success, durationMs) {
  await query(
    `INSERT INTO tool_usage_log (session_id, tool_name, input, output, success, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, toolName, JSON.stringify(input), JSON.stringify(output), success, durationMs]
  );
}
