import { Request, Response, NextFunction } from 'express';
import { setCookie } from '../auth/auth.service';
import { ForbiddenException } from '@nestjs/common';

export function headerMiddleware(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'private, no-cache');
  if (typeof req.cookies['__Host-Http-userToken'] === 'string'){
    setCookie.setTokenCookie(res, req.cookies['__Host-Http-userToken']); // renew age
  }
  if (req.headers['content-type'] !== 'application/json' &&  req.headers['sec-fetch-site'] !== 'same-origin' && req.method !== 'GET'){
      throw new ForbiddenException('possible cross-site');
  }

  next();
};