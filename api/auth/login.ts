import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminConfig, createAdminToken } from './_jwt.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const { username: configuredUsername, password: configuredPassword } = getAdminConfig();

  // If no password configured on the server, reject with security warning
  if (!configuredPassword) {
    console.error('Server error: ADMIN_PASSWORD environment variable is not configured.');
    return res.status(500).json({
      success: false,
      message: 'Server authentication configuration is missing. Please configure ADMIN_PASSWORD in server environment variables.'
    });
  }

  const trimmedInputUser = String(username).trim();
  const trimmedInputPass = String(password).trim();

  // Strict server-side environment variables comparison
  if (trimmedInputUser === configuredUsername && trimmedInputPass === configuredPassword) {
    // Generate 7-day JWT token (7 days = 604800 seconds)
    const tokenData = createAdminToken(trimmedInputUser, 7 * 24 * 60 * 60);

    return res.status(200).json({
      success: true,
      message: 'Authenticated successfully',
      token: tokenData.token,
      expiresIn: tokenData.expiresIn,
      expiresAt: tokenData.expiresAt,
      user: {
        username: trimmedInputUser,
        role: 'admin'
      }
    });
  }

  // Generic 401 response for incorrect credentials
  return res.status(401).json({
    success: false,
    message: 'Incorrect username or password. Access denied.'
  });
}
