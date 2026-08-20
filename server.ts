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
