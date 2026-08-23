import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes FIRST
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;

    const expectedUsername = process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || process.env.VITE_ADMIN_ACTION_PASSWORD || "";

    if (!expectedPassword) {
      if (username === expectedUsername && (password === "admin123" || password === "admin")) {
        return res.json({ success: true, message: "Authenticated successfully" });
      }
    }

    if (username === expectedUsername && password === expectedPassword) {
      return res.json({ success: true, message: "Authenticated successfully" });
    }

    return res.status(401).json({ success: false, message: "Incorrect username or password." });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/audio-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing url parameter");
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
      res.setHeader("Cache-Control", "public, max-age=86400");

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
