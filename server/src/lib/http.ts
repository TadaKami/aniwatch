import {NextFunction, Request, Response} from 'express';

export class HttpError extends Error {
    status: number;
    constructor (status: number, message: string){
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}


/** Роуты пишем без try/catch — ошибки сюда, а в error-middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };