import { NextFunction, Request, Response } from 'express';

/** Wraps an async route handler and forwards errors to Express error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T) {
  return res.status(201).json({ success: true, data });
}

export function noContent(res: Response) {
  return res.status(204).send();
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePagination(req: Request, defaultPageSize = 20, maxPageSize = 100): PaginationParams {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(req.query.pageSize) || defaultPageSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginatedMeta(total: number, params: PaginationParams) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize) || 1,
  };
}
