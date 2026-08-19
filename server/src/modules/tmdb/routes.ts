import { Router } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { optionalAuth, type AuthRequest } from '../../middleware/auth.js';
import * as service from './service.js';

export const tmdbRouter = Router();

tmdbRouter.get(
  '/genres',
  asyncHandler(async (req, res) => {
    const type = req.query.type === 'movie' ? 'movie' : 'tv';
    const genres = (await service.getTmdbGenres(type)).map((g) => ({ id: g.id, name: g.name, russian: g.name }));
    res.json({ genres });
  })
);

tmdbRouter.post(
  '/search',
  asyncHandler(async (req, res) => {
    res.json(await service.searchTmdb(req.body));
  })
);

// ВАЖНО: раньше '/:type/:id', иначе "pick" поймается как type
tmdbRouter.get(
  '/pick/:type',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const type = req.params.type === 'movie' ? 'movie' : 'tv';
    res.json(await service.pickTmdb(type, (req as AuthRequest).userId));
  })
);

tmdbRouter.get(
  '/:type/:id/full',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const type = req.params.type === 'movie' ? 'movie' : 'tv';
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    res.json(await service.getTmdbFullDetails(type, id, (req as AuthRequest).userId));
  })
);

tmdbRouter.get(
  '/:type/:id/season/:n',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const n = Number(req.params.n);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid params');
    res.json(await service.getTmdbSeasonEpisodes(id, n));
  })
);

tmdbRouter.get(
  '/:type/:id/related',
  asyncHandler(async (req, res) => {
    const type = req.params.type === 'movie' ? 'movie' : 'tv';
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    res.json(await service.getTmdbRelated(type, id));
  })
);

// ВАЖНО: после всех более специфичных маршрутов
tmdbRouter.get(
  '/:type/:id',
  asyncHandler(async (req, res) => {
    const type = req.params.type === 'movie' ? 'movie' : 'tv';
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    res.json(await service.getTmdbDetails(type, id));
  })
);