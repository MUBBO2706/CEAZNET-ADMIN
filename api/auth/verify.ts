import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminToken } from './_jwt.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, valid: false, message: 'Method not allowed' });
  }

  // Extract token from Authorization header (Bearer <token>) or body or query
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.body?.token) {
    token = String(req.body.token).trim();
  } else if (req.query?.token) {
    token = String(req.query.token).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: 'No authorization token provided'
    });
  }

  const result = verifyAdminToken(token);

  if (result.valid && result.payload) {
    const daysRemaining = Math.max(0, Math.round((result.payload.exp - Math.floor(Date.now() / 1000)) / 86400));
    return res.status(200).json({
      success: true,
      valid: true,
      message: 'Session is valid',
      user: {
        username: result.payload.username,
        role: result.payload.role
      },
      issuedAt: result.payload.iat,
      expiresAt: result.payload.exp,
      daysRemaining
    });
  }

  return res.status(401).json({
    success: false,
    valid: false,
    message: result.message || 'Session expired or invalid token. Please log in again.'
  });
}
