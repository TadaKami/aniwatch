import { Router, type Request } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import * as service from './service.js';

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth);

function requireUserId(req: Request): string{
    const id = (req as AuthRequest).userId;
    if(!id) throw new HttpError(401, 'Unauthorized');
    return id;
}

watchlistRouter.get(
    '/',
    asyncHandler(async (req, res)=>{
        res.json(await service.listWatchlist(requireUserId(req)));
    })
);

watchlistRouter.post(
    '/',
    asyncHandler(async (req, res)=>{
        res.status(201).json(await service.addToWatchlist(requireUserId(req), req.body));
    })
);

watchlistRouter.post(
    '/progress',
    asyncHandler(async (req, res) => {
        res.json(await service.addProgress(requireUserId(req), req.body));
    })
);

watchlistRouter.delete(
    '/progress',
    asyncHandler(async (req, res)=>{
        res.json(await service.removeProgress(requireUserId(req), req.body));
    })
);

watchlistRouter.patch(
    '/:id',
    asyncHandler(async (req, res)=>{
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            throw new HttpError(400, 'Invalid id');
        }        
        res.json(await service.updateWatchItem(requireUserId(req), req.params.id, req.body));
    })
);

watchlistRouter.delete(
    '/:id',
    asyncHandler(async (req, res) => {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            throw new HttpError(400, 'Invalid id');
        }        
        res.json(await service.removeWatchItem(requireUserId(req), req.params.id));
    })
);