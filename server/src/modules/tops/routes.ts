import { Router, type Request } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import * as service from './service.js';

export const topsRouter = Router();
topsRouter.use(requireAuth);

function uid(req: Request): string {
  const id = (req as AuthRequest).userId;
  if (!id) throw new HttpError(401, 'Unauthorized');
  return id;
}

topsRouter.get('/', asyncHandler(async (req, res) => { res.json(await service.listTops(uid(req))); }));
topsRouter.post('/', asyncHandler(async (req, res) => { res.status(201).json(await service.createTop(uid(req), req.body)); }));
topsRouter.get('/:id', asyncHandler(async (req, res) => { res.json(await service.getTop(uid(req), String(req.params.id))); }));
topsRouter.delete('/:id', asyncHandler(async (req, res) => { res.json(await service.removeTop(uid(req), String(req.params.id))); }));
topsRouter.post('/:id/items', asyncHandler(async (req, res) => { res.status(201).json(await service.addTopItem(uid(req), String(req.params.id), req.body)); }));
topsRouter.delete('/:id/items/:animeId', asyncHandler(async (req, res) => { res.json(await service.removeTopItem(uid(req), String(req.params.id), String(req.params.animeId))); }));
topsRouter.patch('/:id/reorder', asyncHandler(async (req, res) => { res.json(await service.reorderTop(uid(req), String(req.params.id), req.body)); }));