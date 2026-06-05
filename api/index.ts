import express from 'express';
import { apiRouter } from '../api-router';

const app = express();

app.use(apiRouter);

export default app;
