import { NextFunction, Request, Response } from 'express';
import { Permission, roleHasPermission } from '../auth/rbac';
import { Forbidden, Unauthorized } from '../utils/errors';

/** Require the authenticated user to hold ALL of the given permissions. */
export function authorize(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw Unauthorized();
    const missing = required.filter((p) => !roleHasPermission(req.user!.role, p));
    if (missing.length > 0) {
      throw Forbidden(`Missing permission(s): ${missing.join(', ')}`);
    }
    next();
  };
}

/** Require the authenticated user to hold AT LEAST ONE of the given permissions. */
export function authorizeAny(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw Unauthorized();
    const has = required.some((p) => roleHasPermission(req.user!.role, p));
    if (!has) throw Forbidden(`Requires one of: ${required.join(', ')}`);
    next();
  };
}
