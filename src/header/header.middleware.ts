import { Request, Response, NextFunction } from 'express';
import { setCookie } from '../auth/auth.service';

export function headerMiddleware(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'private, no-cache');
  if (typeof req.cookies['__Host-Http-userToken'] === 'string'){
    setCookie.setTokenCookie(res, req.cookies['__Host-Http-userToken']); // renew age
  }
  next();
};