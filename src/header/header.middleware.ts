import { Request, Response, NextFunction } from 'express';

export function headerMiddleware(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'private, no-cache');
  next();
};