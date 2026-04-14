// POST /api/admin-login - Login voor het admin dashboard
import { signToken, checkAdminPassword, jsonResponse, handleOptions } from '../../lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  try {
    const { username, password } = JSON.parse(event.body || '{}');
    const ok = await checkAdminPassword(username, password);
    if (!ok) {
      return jsonResponse(401, { error: 'Ongeldige inloggegevens' });
    }
    const token = signToken({ username, role: 'admin' });
    return jsonResponse(200, { token, username });
  } catch (err) {
    return jsonResponse(500, { error: 'Login fout' });
  }
};
