import express from 'express';
import { apiRouter } from '../api-router';

const app = express();

// Use the exact routes defined in api-router
app.use(apiRouter);

// Export the Express app as a Vercel Serverless Function
export default app;
