import { Router } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import * as service from './service.js';

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get(
  '/genres',
  asyncHandler(async (req, res) => {
    const userId = (req as AuthRequest).userId;
    if (!userId) throw new HttpError(401, 'Unauthorized');
    res.json(await service.getGenreStats(userId));
  })
);