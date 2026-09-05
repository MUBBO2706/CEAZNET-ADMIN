import crypto from 'crypto';

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

const DEFAULT_SECRET_SALT = 'ceaznet-super-secret-admin-jwt-salt-2026';

export function getAdminConfig() {
  const username = (process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || 'admin').trim();
  const password = (process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '').trim();
  
  // Derives a fallback robust secret if ADMIN_JWT_SECRET is not explicitly set
  const jwtSecret = (
    process.env.ADMIN_JWT_SECRET ||
    (password ? crypto.createHash('sha256').update(password + DEFAULT_SECRET_SALT).digest('hex') : 'ceaznet-admin-default-jwt-secret-key-999')
  );

  return { username, password, jwtSecret };
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generates a signed JWT for the admin session with a 7-day expiration (604800 seconds).
 */
export function createAdminToken(username: string, expiresInSeconds = 7 * 24 * 60 * 60): { token: string; expiresIn: number; expiresAt: number } {
  const { jwtSecret } = getAdminConfig();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload: AdminJwtPayload = {
    sub: 'admin',
    username,
    role: 'admin',
    iat: now,
    exp
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', jwtSecret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const token = `${dataToSign}.${signature}`;
  return { token, expiresIn: expiresInSeconds, expiresAt: exp };
}

/**
 * Validates a JWT token against the server-side secret and checks 7-day expiration.
 */
export function verifyAdminToken(token: string): { valid: boolean; payload?: AdminJwtPayload; message?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: 'No token provided' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, message: 'Malformed token' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const { jwtSecret } = getAdminConfig();
  const expectedSignature = crypto
    .createHmac('sha256', jwtSecret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
      return { valid: false, message: 'Invalid token signature' };
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: AdminJwtPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return { valid: false, message: 'Session expired. Please log in again.' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, message: `Token verification error: ${err.message}` };
  }
}
