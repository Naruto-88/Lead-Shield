import express from 'express';
import { apiRouter } from '../api-router.js';

const app = express();

app.use(apiRouter);

export default app;
