// Initialiseer de database - draai dit één keer na deploy
// Gebruik: node db/init.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;

async function init() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL niet ingesteld. Zet deze in .env of als environment variable.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    console.log('📦 Database schema wordt aangemaakt...');
    await pool.query(schema);
    console.log('✅ Database succesvol geïnitialiseerd!');
    console.log('   Tabellen: sessions, messages, faq_entries, feedback, learned_answers, tool_usage_log');
  } catch (err) {
    console.error('❌ Fout bij initialiseren:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
