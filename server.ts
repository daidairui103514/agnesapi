import express from "express";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { historyItems } from "./src/db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database
  const sqlite = new Database("sqlite.db");
  
  // Auto-create table if it doesn't exist (simplifies local dev)
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS history_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default',
        timestamp INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
    `);
    // Add user_id column if it doesn't exist (for existing local db)
    sqlite.exec(`ALTER TABLE history_items ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';`);
  } catch (e) {
    // Ignore duplicate column error on subsequent runs
  }
  
  const db = drizzle(sqlite);

  app.use(express.json());

  // --- API Routes ---
  
  // Get history
  app.get("/api/history", (req, res) => {
    const type = req.query.type as string;
    const user = (req.query.user as string) || 'default';
    if (!type) {
      return res.status(400).json({ error: "Missing type parameter" });
    }
    
    try {
      const results = db.select()
        .from(historyItems)
        .where(and(eq(historyItems.type, type), eq(historyItems.user_id, user)))
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
    const { type, items, user = 'default' } = req.body;
    if (!Array.isArray(items) || !type) {
      return res.status(400).json({ error: "Missing type or items array" });
    }

    try {
      const rows = items.map(item => ({
        id: item.id,
        type,
        user_id: user,
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
    const { type, item, user = 'default' } = req.body;
    
    if (!type || !item || !item.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      db.insert(historyItems)
        .values({ 
          id: item.id, 
          type, 
          user_id: user,
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
    const user = (req.query.user as string) || 'default';
    try {
      db.delete(historyItems)
        .where(and(eq(historyItems.id, id), eq(historyItems.user_id, user)))
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
