import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { BadRequest } from '../utils/errors';

type Part = 'body' | 'query' | 'params';

/** Validate and coerce a request part using a Zod schema; replaces it with parsed output. */
export function validate(schema: ZodSchema, part: Part = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw BadRequest('Validation failed', details);
    }
    // store parsed values where they don't collide with read-only express getters
    if (part === 'query') {
      (req as any).validatedQuery = result.data;
    } else {
      (req as any)[part] = result.data;
    }
    next();
  };
}
