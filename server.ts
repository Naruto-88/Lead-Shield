import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./api-router";

const app = express();
const PORT = 3000;

// Use the API Router for all backend endpoints
app.use(apiRouter);

async function startServer() {
  // We only start the Express server if we are NOT running in a serverless environment (like Vercel)
  // Vercel sets the VERCEL environment variable to "1"
  if (process.env.VERCEL) {
    console.log("[LeadShield] Running in Vercel Serverless mode. Skipping local Express listen().");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LeadShield API] Express Server listening securely on internal Port :${PORT}`);
  });
}

startServer();
