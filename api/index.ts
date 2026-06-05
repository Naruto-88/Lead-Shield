import express from 'express';

const app = express();

app.all('*', async (req, res, next) => {
  try {
    // Dynamically import api-router so if it crashes on boot, we can catch it!
    const module = await import('../api-router');
    module.apiRouter(req, res, next);
  } catch (err: any) {
    console.error("Boot Error:", err);
    res.status(500).json({ 
      error: "Vercel Backend failed to boot", 
      details: err.message, 
      stack: err.stack 
    });
  }
});

export default app;
