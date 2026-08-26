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
