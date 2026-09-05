import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = 'https://itjurgqbvsqniphuehiz.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4Mzk1OCwiZXhwIjoyMDkwODU5OTU4fQ.FgnMsY9Oz2ITeBTg3wyldmftSV6c9rYeScx_hC0Syxc';

const supabaseUrl = process.env.VITE_MAIN_SUPABASE_URL || process.env.MAIN_SUPABASE_URL || FALLBACK_URL;
const supabaseKey = process.env.VITE_MAIN_SUPABASE_SERVICE_KEY || process.env.MAIN_SUPABASE_SERVICE_KEY || FALLBACK_KEY;
const dbClient = createClient(supabaseUrl, supabaseKey);

async function verifyDbLogin(usernameInput: string, passwordInput: string): Promise<boolean> {
  if (!usernameInput || !passwordInput) return false;

  // 1. Check Server-Side Environment Variables First
  const envAdminUser = (process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || "").trim();
  const envAdminPass = (process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || "").trim();

  if (envAdminUser && envAdminPass) {
    if (usernameInput === envAdminUser && passwordInput === envAdminPass) {
      return true;
    }
  }

  // 2. Check platform_settings table for admin_credentials
  try {
    const { data: settingData } = await dbClient
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "admin_credentials")
      .maybeSingle();

    if (settingData?.setting_value) {
      let parsed: any = {};
      try {
        parsed = typeof settingData.setting_value === "string" 
          ? JSON.parse(settingData.setting_value) 
          : settingData.setting_value;
      } catch (e) {
        // ignore JSON parse error
      }
      if (parsed?.username && parsed?.password) {
        if (usernameInput === parsed.username && passwordInput === parsed.password) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn("DB check platform_settings error:", err);
  }

  // 2. Check admin_users table if present in schema
  try {
    const { data: adminUser } = await dbClient
      .from("admin_users")
      .select("*")
      .or(`username.eq.${usernameInput},email.eq.${usernameInput}`)
      .maybeSingle();

    if (adminUser) {
      if (adminUser.password === passwordInput || adminUser.password_hash === passwordInput) {
        return true;
      }
    }
  } catch (err) {
    // table might not exist
  }

  // 3. Check verify_admin_login RPC if available
  try {
    const { data: rpcVal } = await dbClient.rpc("verify_admin_login", {
      p_username: usernameInput,
      p_password: passwordInput,
    });
    if (rpcVal === true) return true;
  } catch (err) {
    // rpc might not exist
  }

  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes FIRST
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }

    const isValid = await verifyDbLogin(username, password);

    if (isValid) {
      return res.json({ success: true, message: "Authenticated successfully" });
    }

    return res.status(401).json({ success: false, message: "Incorrect username or password." });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.options("/api/audio-proxy", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
    res.sendStatus(204);
  });

  app.get("/api/audio-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing url parameter");
    }

    let cleanUrl = url;
    if (cleanUrl.includes("?")) {
      cleanUrl = cleanUrl.split("?")[0];
    }
    if (cleanUrl.includes("#")) {
      cleanUrl = cleanUrl.split("#")[0];
    }

    // Handle local files
    if (cleanUrl.startsWith("/")) {
      const decodedPath = decodeURIComponent(cleanUrl);
      const safePath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(process.cwd(), "public", safePath);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Local audio serve error:", err);
          if (!res.headersSent) {
            res.status(404).send("Audio file not found");
          }
        }
      });
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch audio: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("content-type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error("Audio proxy error:", err);
      res.status(500).send(`Audio proxy failed: ${err.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
