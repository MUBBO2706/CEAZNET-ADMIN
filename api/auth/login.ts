import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://itjurgqbvsqniphuehiz.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4Mzk1OCwiZXhwIjoyMDkwODU5OTU4fQ.FgnMsY9Oz2ITeBTg3wyldmftSV6c9rYeScx_hC0Syxc';

const supabaseUrl = process.env.VITE_MAIN_SUPABASE_URL || process.env.MAIN_SUPABASE_URL || FALLBACK_URL;
const supabaseKey = process.env.VITE_MAIN_SUPABASE_SERVICE_KEY || process.env.MAIN_SUPABASE_SERVICE_KEY || FALLBACK_KEY;
const dbClient = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  // 1. Check Server-Side Environment Variables First
  const envAdminUser = (process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || '').trim();
  const envAdminPass = (process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '').trim();

  if (envAdminUser && envAdminPass) {
    if (username === envAdminUser && password === envAdminPass) {
      return res.status(200).json({ success: true, message: 'Authenticated successfully via server configuration' });
    }
  }

  // 2. Check platform_settings table for admin_credentials
  try {
    const { data: settingData } = await dbClient
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_credentials')
      .maybeSingle();

    if (settingData?.setting_value) {
      let parsed: any = {};
      try {
        parsed = typeof settingData.setting_value === 'string'
          ? JSON.parse(settingData.setting_value)
          : settingData.setting_value;
      } catch (e) {
        // ignore
      }
      if (parsed?.username && parsed?.password) {
        if (username === parsed.username && password === parsed.password) {
          return res.status(200).json({ success: true, message: 'Authenticated successfully' });
        }
      }
    }
  } catch (err) {
    console.warn('DB check platform_settings error:', err);
  }

  // 2. Check admin_users table
  try {
    const { data: adminUser } = await dbClient
      .from('admin_users')
      .select('*')
      .or(`username.eq.${username},email.eq.${username}`)
      .maybeSingle();

    if (adminUser) {
      if (adminUser.password === password || adminUser.password_hash === password) {
        return res.status(200).json({ success: true, message: 'Authenticated successfully' });
      }
    }
  } catch (err) {
    // ignore
  }

  // 3. Check verify_admin_login RPC
  try {
    const { data: rpcVal } = await dbClient.rpc('verify_admin_login', {
      p_username: username,
      p_password: password,
    });
    if (rpcVal === true) {
      return res.status(200).json({ success: true, message: 'Authenticated successfully' });
    }
  } catch (err) {
    // ignore
  }

  return res.status(401).json({ success: false, message: 'Incorrect username or password.' });
}
