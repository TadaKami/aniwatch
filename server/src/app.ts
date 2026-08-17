import express from 'express';
import cors from 'cors';
import { sql } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { env } from './config/env.js';
import { db } from './db/client.js';
import { users } from './db/schema.js';
import { HttpError } from './lib/http.js';
import { animeRouter } from './modules/anime/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { statsRouter } from './modules/stats/routes.js';
import { watchlistRouter } from './modules/watchlist/routes.js';

export const app = express();
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/anime', animeRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/stats', statsRouter);

app.get('/api/health', async (_req, res) => {
  try {
    await db.execute(sql`select 1 as ok`);
    const userCount = await db.$count(users);
    res.json({ status: 'ok', db: true, userCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', error: String(err) });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError && 'status' in err) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});