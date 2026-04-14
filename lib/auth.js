// Simpele JWT-based auth voor admin dashboard
import jwt from 'jsonwebtoken';

const JWT_SECRET = () => process.env.JWT_SECRET || 'change-this-secret';
const TOKEN_TTL = '7d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET());
  } catch {
    return null;
  }
}

export function extractToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function requireAuth(event) {
  const token = extractToken(event);
  if (!token) return null;
  return verifyToken(token);
}

export async function checkAdminPassword(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || '';
  if (!expectedPass) return false;
  if (username !== expectedUser) return false;
  // Plain text vergelijking omdat we env var gebruiken
  return password === expectedPass;
}

// CORS headers helper
export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function handleOptions() {
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}
