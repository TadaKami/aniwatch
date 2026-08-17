import {Router} from 'express';
import {asyncHandler} from '../../lib/http';
import * as service from './service';

export const authRouter = Router();

authRouter.post(
    '/register',
    asyncHandler(async (req, res) => {
        const result = await service.register(req.body);
        res.status(201).json(result);
    })
);

authRouter.post(
    '/login',
    asyncHandler(async (req, res) =>{
        const result = await service.login(req.body);
        res.json(result);
    })
);