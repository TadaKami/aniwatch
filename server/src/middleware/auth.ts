import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';
import {HttpError} from '../lib/http.js';

export interface AuthRequest extends Request{
    userId?: string;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if(!header?.startsWith('Bearer')){
        return next(new HttpError(401, 'Unauthorized: missing token'));
    }
    try{
        const payload = jwt.verify(header.slice('Bearer '.length), env.JWT_SECRET) as {sub: string};
        req.userId = payload.sub;
        next();
    }catch{
        next(new HttpError(401, 'Unauthorized: invalid or expired token'))
    }
}


/** Токен опционален: есть валидный — ставим userId, нет — просто пропускаем. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void{
    const header = req.headers.authorization;
    if(!header?.startsWith('Bearer')) return next();

    try{
        const payload = jwt.verify(header.slice('Bearer '.length),env.JWT_SECRET) as {sub: string};
        req.userId = payload.sub;
        next();
    }catch{
        next(new HttpError(401, 'Unauthorized: invalid or expired token'));
    }
}