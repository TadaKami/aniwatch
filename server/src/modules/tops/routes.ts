import { Router, type Request } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import * as service from './service.js';

export const topsRouter = Router();

function uid(req: Request): string {
  const id = (req as AuthRequest).userId;
  if (!id) throw new HttpError(401, 'Unauthorized');
  return id;
}

topsRouter.get('/', asyncHandler(async (_req, res) => { res.json(await service.listTops()); }));
topsRouter.post('/', requireAuth, asyncHandler(async (req, res) => { res.status(201).json(await service.createTop(uid(req), req.body)); }));
topsRouter.get('/:id', asyncHandler(async (req, res) => { res.json(await service.getTop(String(req.params.id))); }));
topsRouter.post('/:id/items', requireAuth, asyncHandler(async (req, res) => { res.status(201).json(await service.addTopItem(uid(req), String(req.params.id), req.body)); }));
topsRouter.delete('/:id/items/:animeId', requireAuth, asyncHandler(async (req, res) => { res.json(await service.removeTopItem(uid(req), String(req.params.id), String(req.params.animeId))); }));
topsRouter.patch('/:id/reorder', requireAuth, asyncHandler(async (req, res) => { res.json(await service.reorderTop(uid(req), String(req.params.id), req.body)); }));
topsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => { res.json(await service.removeTop(uid(req), String(req.params.id))); }));