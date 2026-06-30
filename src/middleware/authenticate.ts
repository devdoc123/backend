import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../auth/tokens';
import { Unauthorized } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw Unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw Unauthorized('Invalid or expired access token');
  }
}
