import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Postgres unique violation -> 409
  const pgErr = err as { code?: string; detail?: string };
  if (pgErr && pgErr.code === '23505') {
    res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with these values already exists', details: pgErr.detail },
    });
    return;
  }
  // Postgres foreign key violation -> 400
  if (pgErr && pgErr.code === '23503') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Referenced record does not exist', details: pgErr.detail },
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
