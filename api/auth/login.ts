import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  const expectedUsername = process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || process.env.VITE_ADMIN_ACTION_PASSWORD || "";

  if (!expectedPassword) {
    if (username === expectedUsername && (password === "admin123" || password === "admin")) {
      return res.status(200).json({ success: true, message: "Authenticated successfully" });
    }
  }

  if (username === expectedUsername && password === expectedPassword) {
    return res.status(200).json({ success: true, message: "Authenticated successfully" });
  }

  return res.status(401).json({ success: false, message: "Incorrect username or password." });
}
