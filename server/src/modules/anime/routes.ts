import { Router } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import {optionalAuth, type AuthRequest} from '../../middleware/auth.js';
import * as service from './service.js';

export const animeRouter = Router();

animeRouter.get(
  '/genres',
  asyncHandler(async (_req, res) => {
    const genres = await service.getGenres();
    res.json({ genres });
  })
);

animeRouter.post(
  '/search',
  optionalAuth,
  asyncHandler(async (req, res)=>{
    const userId = (req as AuthRequest).userId;
    const result = await service.searchAnimes(req.body, userId);
    res.json(result);
  })
);

animeRouter.get(
  '/cover-status',
  asyncHandler(async (req, res)=>{
    const  url = String(req.query.u ?? '');
    if(!url.startsWith('http')) throw new HttpError(400, 'Invalid uri');

    res.json({ok: await service.coverExists(url)});
  })
);

animeRouter.get(
  '/:id/episodes',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid anime id');
    res.json(await service.getEpisodes(id));
  })
);
animeRouter.get(
  '/:id/related',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid anime id');
    res.json(await service.getRelated(id));
  })
);

animeRouter.get(
  '/pick',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(await service.pickRandom((req as AuthRequest).userId));
  })
);

// ВАЖНО: после /genres, иначе "genres" поймается как :id
animeRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res)=>{
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid anime id');

    const userId = (req as AuthRequest).userId;
    const result = await service.getAnimeDetails(id, userId);
    res.json(result);
  })
)