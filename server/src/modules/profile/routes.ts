import { Router } from 'express';
import { asyncHandler, HttpError } from '../../lib/http.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import * as service from './service.js';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await service.getProfile((req as AuthRequest).userId!));
  })
);

profileRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await service.updateProfile((req as AuthRequest).userId!, req.body));
  })
);