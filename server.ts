import express from "express";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { historyItems } from "./src/db/schema.js";
import { eq, desc } from "drizzle-orm";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database
  const sqlite = new Database("sqlite.db");
  
  // Auto-create table if it doesn't exist (simplifies local dev)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS history_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
  `);
  
  const db = drizzle(sqlite);

  app.use(express.json());

  // --- API Routes ---
  
  // Get history
  app.get("/api/history", (req, res) => {
    const type = req.query.type as string;
    if (!type) {
      return res.status(400).json({ error: "Missing type parameter" });
    }
    
    try {
      const results = db.select()
        .from(historyItems)
        .where(eq(historyItems.type, type))
        .orderBy(desc(historyItems.timestamp))
        .all();
      
      const parsedResults = results.map(row => JSON.parse(row.payload));
      res.json(parsedResults);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sync a batch of history items (useful for initial migration from LocalStorage)
  app.post("/api/history/sync", (req, res) => {
    const { type, items } = req.body;
    if (!Array.isArray(items) || !type) {
      return res.status(400).json({ error: "Missing type or items array" });
    }

    try {
      const rows = items.map(item => ({
        id: item.id,
        type,
        timestamp: item.timestamp,
        payload: JSON.stringify(item)
      }));

      if (rows.length > 0) {
        // Insert with on conflict do nothing
        db.insert(historyItems)
          .values(rows)
          .onConflictDoNothing()
          .run();
      }
      res.json({ success: true, count: rows.length });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Save a single history item
  app.post("/api/history", (req, res) => {
    const { type, item } = req.body;
    
    if (!type || !item || !item.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      db.insert(historyItems)
        .values({ 
          id: item.id, 
          type, 
          timestamp: item.timestamp || Date.now(),
          payload: JSON.stringify(item) 
        })
        .onConflictDoNothing()
        .run();
      
      res.json({ success: true, id: item.id });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Delete a history item
  app.delete("/api/history/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.delete(historyItems)
        .where(eq(historyItems.id, id))
        .run();
      res.json({ success: true, id });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });


  // --- Vite Middleware (Development) / Static Files (Production) ---
  if (process.env.NODE_ENV !== "production") {
    // In dev, use Vite's middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the dist folder
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
