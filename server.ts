import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getAdminConfig, createAdminToken, verifyAdminToken } from "./api/auth/_jwt.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes FIRST
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const { username: configuredUsername, password: configuredPassword } = getAdminConfig();

    if (!configuredPassword) {
      console.error("Server error: ADMIN_PASSWORD environment variable is not configured.");
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration is missing. Please configure ADMIN_PASSWORD in server environment variables."
      });
    }

    const trimmedInputUser = String(username).trim();
    const trimmedInputPass = String(password).trim();

    // Strict Server-Side Environment Variables Authentication
    if (trimmedInputUser === configuredUsername && trimmedInputPass === configuredPassword) {
      // 7-day token (7 days = 604800 seconds)
      const tokenData = createAdminToken(trimmedInputUser, 7 * 24 * 60 * 60);

      return res.json({
        success: true,
        message: "Authenticated successfully",
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        expiresAt: tokenData.expiresAt,
        user: {
          username: trimmedInputUser,
          role: "admin"
        }
      });
    }

    return res.status(401).json({ success: false, message: "Incorrect username or password. Access denied." });
  });

  app.all(["/api/auth/verify", "/api/auth/session"], (req, res) => {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.sendStatus(204);
    }

    const authHeader = req.headers.authorization || "";
    let token = "";

    if (authHeader.startsWith("Bearer ")) {
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
        message: "No authorization token provided"
      });
    }

    const result = verifyAdminToken(token);

    if (result.valid && result.payload) {
      const daysRemaining = Math.max(0, Math.round((result.payload.exp - Math.floor(Date.now() / 1000)) / 86400));
      return res.json({
        success: true,
        valid: true,
        message: "Session is valid",
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
      message: result.message || "Session expired or invalid token. Please log in again."
    });
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
